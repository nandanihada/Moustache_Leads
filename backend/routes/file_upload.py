from flask import Blueprint, request, jsonify, send_file
from services.file_upload_service import FileUploadService
from utils.auth import token_required
import logging
import os

file_upload_bp = Blueprint('file_upload', __name__)
upload_service = FileUploadService()
logger = logging.getLogger(__name__)

@file_upload_bp.route('/api/files/upload', methods=['POST'])
@token_required
def upload_file(current_user):
    """Upload a creative file"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        offer_id = request.form.get('offer_id')
        description = request.form.get('description', '')
        
        result = upload_service.upload_file(
            file=file,
            user_id=current_user['_id'],
            offer_id=offer_id,
            description=description
        )
        
        if 'error' in result:
            return jsonify(result), 400
        
        return jsonify(result), 201
        
    except Exception as e:
        logger.error(f"Error uploading file: {str(e)}")
        return jsonify({'error': 'Upload failed'}), 500

@file_upload_bp.route('/api/files/<file_id>', methods=['GET'])
def get_file(file_id):
    """Serve uploaded file"""
    try:
        file_path = upload_service.get_file_path(file_id)
        
        if not file_path or not os.path.exists(file_path):
            return jsonify({'error': 'File not found'}), 404
        
        return send_file(file_path)
        
    except Exception as e:
        logger.error(f"Error serving file: {str(e)}")
        return jsonify({'error': 'File access failed'}), 500

@file_upload_bp.route('/api/files/<file_id>/info', methods=['GET'])
@token_required
def get_file_info(current_user, file_id):
    """Get file information"""
    try:
        file_info = upload_service.get_file_info(file_id)
        
        if not file_info:
            return jsonify({'error': 'File not found'}), 404
        
        return jsonify(file_info)
        
    except Exception as e:
        logger.error(f"Error getting file info: {str(e)}")
        return jsonify({'error': 'Failed to get file info'}), 500

@file_upload_bp.route('/api/files/<file_id>', methods=['DELETE'])
@token_required
def delete_file(current_user, file_id):
    """Delete a file"""
    try:
        result = upload_service.delete_file(file_id, current_user['_id'])
        
        if 'error' in result:
            return jsonify(result), 400
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error deleting file: {str(e)}")
        return jsonify({'error': 'Delete failed'}), 500

@file_upload_bp.route('/api/files/user/<user_id>', methods=['GET'])
@token_required
def get_user_files(current_user, user_id):
    """Get all files uploaded by a user"""
    try:
        # Users can only access their own files
        if str(current_user['_id']) != user_id:
            return jsonify({'error': 'Access denied'}), 403
        
        offer_id = request.args.get('offer_id')
        files = upload_service.get_user_files(current_user['_id'], offer_id)
        
        return jsonify({
            'files': files,
            'total': len(files)
        })
        
    except Exception as e:
        logger.error(f"Error getting user files: {str(e)}")
        return jsonify({'error': 'Failed to get files'}), 500
