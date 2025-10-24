import os
import uuid
import logging
from werkzeug.utils import secure_filename
from datetime import datetime
from database import db_instance

class FileUploadService:
    """Service to handle file uploads for creative assets"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.files_collection = db_instance.get_collection('uploaded_files')
        
        # Create upload directory if it doesn't exist
        self.upload_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'uploads')
        os.makedirs(self.upload_dir, exist_ok=True)
        
        # Allowed file extensions
        self.allowed_extensions = {
            'image': {'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'},
            'video': {'mp4', 'avi', 'mov', 'wmv', 'flv'},
            'document': {'pdf', 'doc', 'docx', 'txt'},
            'archive': {'zip', 'rar', '7z', 'tar', 'gz'}
        }
        
        # Max file size (10MB)
        self.max_file_size = 10 * 1024 * 1024
    
    def allowed_file(self, filename):
        """Check if file extension is allowed"""
        if '.' not in filename:
            return False
        
        extension = filename.rsplit('.', 1)[1].lower()
        
        for category, extensions in self.allowed_extensions.items():
            if extension in extensions:
                return True, category
        
        return False, None
    
    def upload_file(self, file, user_id, offer_id=None, description=''):
        """
        Upload a file and store metadata
        
        Args:
            file: Werkzeug FileStorage object
            user_id: ID of user uploading file
            offer_id: Optional offer ID to associate with
            description: Optional file description
        
        Returns:
            dict: Upload result with file info or error
        """
        try:
            if not file or file.filename == '':
                return {'error': 'No file selected'}
            
            # Check file extension
            is_allowed, file_category = self.allowed_file(file.filename)
            if not is_allowed:
                return {'error': 'File type not allowed'}
            
            # Check file size
            file.seek(0, os.SEEK_END)
            file_size = file.tell()
            file.seek(0)
            
            if file_size > self.max_file_size:
                return {'error': f'File too large. Max size: {self.max_file_size // (1024*1024)}MB'}
            
            # Generate unique filename
            file_id = str(uuid.uuid4())
            original_filename = secure_filename(file.filename)
            file_extension = original_filename.rsplit('.', 1)[1].lower()
            stored_filename = f"{file_id}.{file_extension}"
            
            # Save file to disk
            file_path = os.path.join(self.upload_dir, stored_filename)
            file.save(file_path)
            
            # Store metadata in database
            file_doc = {
                'file_id': file_id,
                'original_filename': original_filename,
                'stored_filename': stored_filename,
                'file_path': file_path,
                'file_size': file_size,
                'file_category': file_category,
                'file_extension': file_extension,
                'mime_type': file.content_type,
                'uploaded_by': user_id,
                'offer_id': offer_id,
                'description': description,
                'upload_date': datetime.utcnow(),
                'is_active': True
            }
            
            result = self.files_collection.insert_one(file_doc)
            file_doc['_id'] = str(result.inserted_id)
            
            # Generate access URL
            access_url = f"/api/files/{file_id}"
            
            return {
                'success': True,
                'file_id': file_id,
                'filename': original_filename,
                'file_size': file_size,
                'file_category': file_category,
                'access_url': access_url,
                'upload_date': file_doc['upload_date']
            }
            
        except Exception as e:
            self.logger.error(f"Error uploading file: {str(e)}")
            return {'error': f'Upload failed: {str(e)}'}
    
    def get_file_info(self, file_id):
        """Get file information by ID"""
        try:
            file_doc = self.files_collection.find_one({'file_id': file_id, 'is_active': True})
            
            if not file_doc:
                return None
            
            file_doc['_id'] = str(file_doc['_id'])
            return file_doc
            
        except Exception as e:
            self.logger.error(f"Error getting file info: {str(e)}")
            return None
    
    def get_file_path(self, file_id):
        """Get file system path for a file"""
        try:
            file_doc = self.files_collection.find_one({'file_id': file_id, 'is_active': True})
            
            if not file_doc:
                return None
            
            return file_doc.get('file_path')
            
        except Exception as e:
            self.logger.error(f"Error getting file path: {str(e)}")
            return None
    
    def delete_file(self, file_id, user_id):
        """Delete a file (soft delete)"""
        try:
            # Check if user owns the file
            file_doc = self.files_collection.find_one({
                'file_id': file_id,
                'uploaded_by': user_id,
                'is_active': True
            })
            
            if not file_doc:
                return {'error': 'File not found or access denied'}
            
            # Soft delete
            self.files_collection.update_one(
                {'file_id': file_id},
                {
                    '$set': {
                        'is_active': False,
                        'deleted_at': datetime.utcnow()
                    }
                }
            )
            
            return {'success': True, 'message': 'File deleted successfully'}
            
        except Exception as e:
            self.logger.error(f"Error deleting file: {str(e)}")
            return {'error': f'Delete failed: {str(e)}'}
    
    def get_user_files(self, user_id, offer_id=None):
        """Get all files uploaded by a user"""
        try:
            query = {'uploaded_by': user_id, 'is_active': True}
            
            if offer_id:
                query['offer_id'] = offer_id
            
            files = list(self.files_collection.find(query).sort('upload_date', -1))
            
            # Convert ObjectId to string
            for file_doc in files:
                file_doc['_id'] = str(file_doc['_id'])
                file_doc['access_url'] = f"/api/files/{file_doc['file_id']}"
            
            return files
            
        except Exception as e:
            self.logger.error(f"Error getting user files: {str(e)}")
            return []
