"""
Simple test endpoint to verify level progression UI
Add this to your app.py temporarily to test
"""

from flask import Blueprint, jsonify
from utils.auth import token_required

test_level_ui_bp = Blueprint('test_level_ui', __name__)

@test_level_ui_bp.route('/api/admin/publishers/level-check', methods=['POST'])
@token_required
def test_level_check():
    """Test endpoint that returns mock eligible users"""
    from flask import request
    
    data = request.get_json()
    publisher_ids = data.get('publisher_ids', [])
    
    # Return mock data with some eligible users
    results = []
    for idx, pub_id in enumerate(publisher_ids):
        # Make every 3rd user eligible
        is_eligible = (idx % 3 == 0)
        
        if is_eligible:
            results.append({
                'publisher_id': pub_id,
                'username': f'test_user_{idx}',
                'current_level': 'L3',
                'next_level': 'L4',
                'eligible': True,
                'reason': 'Requested 5 offer(s)',
                'criteria_met': {
                    'offers_requested': True
                }
            })
        else:
            results.append({
                'publisher_id': pub_id,
                'username': f'test_user_{idx}',
                'current_level': f'L{(idx % 7) + 1}',
                'next_level': None,
                'eligible': False,
                'reason': '',
                'criteria_met': {}
            })
    
    return jsonify({
        'success': True,
        'results': results
    }), 200
