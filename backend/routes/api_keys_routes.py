from flask import Blueprint, request, jsonify
from utils.auth import token_required
from models.api_keys_model import ApiKeyModel
import logging

logger = logging.getLogger(__name__)

api_keys_bp = Blueprint('api_keys', __name__)
api_keys_model = ApiKeyModel()

@api_keys_bp.route('/keys', methods=['GET'])
@token_required
def get_api_keys():
    try:
        user_id = str(request.current_user['_id'])
        keys = api_keys_model.get_keys_by_user(user_id)
        return jsonify({'success': True, 'api_keys': keys}), 200
    except Exception as e:
        logger.error(f"Error fetching API keys: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@api_keys_bp.route('/keys', methods=['POST'])
@token_required
def create_api_key():
    try:
        user_id = str(request.current_user['_id'])
        data = request.get_json()
        
        if not data or not data.get('key_name'):
            return jsonify({'success': False, 'error': 'key_name is required'}), 400
            
        key_doc, error = api_keys_model.create_api_key(user_id, data['key_name'])
        
        if error:
            return jsonify({'success': False, 'error': error}), 500
            
        return jsonify({'success': True, 'api_key': key_doc}), 201
    except Exception as e:
        logger.error(f"Error creating API key: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@api_keys_bp.route('/keys/<key_id>/status', methods=['PATCH'])
@token_required
def update_api_key_status(key_id):
    try:
        user_id = str(request.current_user['_id'])
        data = request.get_json()
        
        if 'status' not in data:
            return jsonify({'success': False, 'error': 'status is required'}), 400
            
        success = api_keys_model.update_status(key_id, user_id, data['status'])
        
        if success:
            return jsonify({'success': True}), 200
        else:
            return jsonify({'success': False, 'error': 'Failed to update status'}), 400
    except Exception as e:
        logger.error(f"Error updating API key status: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@api_keys_bp.route('/keys/<key_id>', methods=['DELETE'])
@token_required
def delete_api_key(key_id):
    try:
        user_id = str(request.current_user['_id'])
        success = api_keys_model.delete_key(key_id, user_id)
        if success:
            return jsonify({'success': True}), 200
        else:
            return jsonify({'success': False, 'error': 'Failed to delete key'}), 400
    except Exception as e:
        logger.error(f"Error deleting API key: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


@api_keys_bp.route('/keys/postback', methods=['GET', 'POST'])
@token_required
def manage_postback_url():
    try:
        from database import db_instance
        from bson import ObjectId
        user_id = ObjectId(request.current_user['_id'])
        users_col = db_instance.get_collection('users')
        
        if request.method == 'GET':
            user = users_col.find_one({'_id': user_id})
            return jsonify({'success': True, 'postback_url': user.get('postback_url', '')}), 200
            
        elif request.method == 'POST':
            data = request.get_json()
            postback_url = data.get('postback_url', '').strip()
            
            users_col.update_one({'_id': user_id}, {'$set': {'postback_url': postback_url}})
            return jsonify({'success': True, 'message': 'Postback URL updated successfully', 'postback_url': postback_url}), 200
            
    except Exception as e:
        logger.error(f"Error managing postback url: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500
