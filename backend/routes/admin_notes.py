"""
Admin Notes API Routes
Endpoints for managing admin suggestion notes
"""

from flask import Blueprint, request, jsonify
from models.admin_note import AdminNote
from utils.auth import token_required
from database import db_instance
import logging

logger = logging.getLogger(__name__)

admin_notes_bp = Blueprint('admin_notes', __name__)

def admin_required(f):
    """Decorator to require admin role"""
    from functools import wraps
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user = getattr(request, 'current_user', None)
        if not user or user.get('role') not in ('admin', 'subadmin'):
            return jsonify({'error': 'Admin access required'}), 403
        return f(*args, **kwargs)
    return decorated_function


@admin_notes_bp.route('/api/admin/notes/counts', methods=['GET'])
@token_required
@admin_required
def get_counts():
    """Get counts for dashboard"""
    try:
        # Check if database is connected
        if not db_instance.is_connected():
            return jsonify({
                'success': True,
                'counts': {
                    'total': 0,
                    'by_type': {},
                    'by_status': {},
                    'by_priority': {}
                }
            }), 200
        
        admin_note = AdminNote(db_instance.get_db())
        counts = admin_note.get_counts()
        
        return jsonify({
            'success': True,
            'counts': counts
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting note counts: {str(e)}", exc_info=True)
        # Return empty counts instead of error to prevent UI breaking
        return jsonify({
            'success': True,
            'counts': {
                'total': 0,
                'by_type': {},
                'by_status': {},
                'by_priority': {}
            }
        }), 200


@admin_notes_bp.route('/api/admin/notes', methods=['GET'])
@token_required
@admin_required
def get_notes():
    """Get all admin notes with optional filters"""
    try:
        # Check if database is connected
        if not db_instance.is_connected():
            return jsonify({
                'success': True,
                'notes': [],
                'counts': {
                    'total': 0,
                    'by_type': {},
                    'by_status': {},
                    'by_priority': {}
                }
            }), 200
        
        admin_note = AdminNote(db_instance.get_db())
        
        filters = {
            'page': request.args.get('page', 'all'),
            'type': request.args.get('type', 'all'),
            'status': request.args.get('status', 'all'),
            'priority': request.args.get('priority', 'all'),
            'search': request.args.get('search', ''),
            'sort': request.args.get('sort', 'newest')
        }
        
        notes = admin_note.get_all_notes(filters)
        counts = admin_note.get_counts()
        
        return jsonify({
            'success': True,
            'notes': notes,
            'counts': counts
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting admin notes: {str(e)}", exc_info=True)
        # Return empty data instead of error
        return jsonify({
            'success': True,
            'notes': [],
            'counts': {
                'total': 0,
                'by_type': {},
                'by_status': {},
                'by_priority': {}
            }
        }), 200


@admin_notes_bp.route('/api/admin/notes', methods=['POST'])
@token_required
@admin_required
def create_note():
    """Create a new admin note"""
    try:
        user = request.current_user
        data = request.get_json()
        
        if not data.get('title') or not data.get('type'):
            return jsonify({'error': 'Title and type are required'}), 400
        
        if data['type'] not in ['bug', 'issue', 'idea', 'task', 'general']:
            return jsonify({'error': 'Invalid note type'}), 400
        
        data['created_by'] = user.get('username') or user.get('email')
        
        admin_note = AdminNote(db_instance.get_db())
        note = admin_note.create_note(data)
        
        return jsonify({
            'success': True,
            'note': note
        }), 201
        
    except Exception as e:
        logger.error(f"Error creating admin note: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@admin_notes_bp.route('/api/admin/notes/<note_id>', methods=['GET'])
@token_required
@admin_required
def get_note(note_id):
    """Get a single note by ID"""
    try:
        admin_note = AdminNote(db_instance.get_db())
        note = admin_note.get_note_by_id(note_id)
        
        if not note:
            return jsonify({'error': 'Note not found'}), 404
        
        return jsonify({
            'success': True,
            'note': note
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting admin note: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@admin_notes_bp.route('/api/admin/notes/<note_id>', methods=['PUT'])
@token_required
@admin_required
def update_note(note_id):
    """Update an admin note"""
    try:
        data = request.get_json()
        
        admin_note = AdminNote(db_instance.get_db())
        updated_note = admin_note.update_note(note_id, data)
        
        if not updated_note:
            return jsonify({'error': 'Note not found or not updated'}), 404
        
        return jsonify({
            'success': True,
            'note': updated_note
        }), 200
        
    except Exception as e:
        logger.error(f"Error updating admin note: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@admin_notes_bp.route('/api/admin/notes/<note_id>', methods=['DELETE'])
@token_required
@admin_required
def delete_note(note_id):
    """Delete an admin note"""
    try:
        admin_note = AdminNote(db_instance.get_db())
        success = admin_note.delete_note(note_id)
        
        if not success:
            return jsonify({'error': 'Note not found'}), 404
        
        return jsonify({
            'success': True,
            'message': 'Note deleted successfully'
        }), 200
        
    except Exception as e:
        logger.error(f"Error deleting admin note: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@admin_notes_bp.route('/api/admin/notes/<note_id>/status', methods=['PATCH'])
@token_required
@admin_required
def update_note_status(note_id):
    """Update note status (cycle through pending -> in-progress -> completed)"""
    try:
        data = request.get_json()
        status = data.get('status')
        
        if status not in ['pending', 'in-progress', 'completed']:
            return jsonify({'error': 'Invalid status'}), 400
        
        admin_note = AdminNote(db_instance.get_db())
        updated_note = admin_note.update_note(note_id, {'status': status})
        
        if not updated_note:
            return jsonify({'error': 'Note not found'}), 404
        
        return jsonify({
            'success': True,
            'note': updated_note
        }), 200
        
    except Exception as e:
        logger.error(f"Error updating note status: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500
