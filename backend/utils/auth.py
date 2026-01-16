import jwt
import logging
from datetime import datetime, timedelta
from functools import wraps
from flask import request, jsonify, current_app
from config import Config
from models.user import User

def generate_token(user_data):
    """Generate JWT token for user"""
    payload = {
        'user_id': str(user_data['_id']),
        'username': user_data['username'],
        'exp': datetime.utcnow() + timedelta(seconds=Config.JWT_EXPIRATION_DELTA),
        'iat': datetime.utcnow()
    }
    
    token = jwt.encode(payload, Config.JWT_SECRET_KEY, algorithm='HS256')
    return token

def decode_token(token):
    """Decode JWT token"""
    try:
        payload = jwt.decode(token, Config.JWT_SECRET_KEY, algorithms=['HS256'])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

def token_required(f):
    """Decorator to require valid JWT token"""
    @wraps(f)
    def decorated(*args, **kwargs):
        # Allow OPTIONS requests (CORS preflight) without authentication
        # Return empty 200 response - the after_request handler will add CORS headers
        if request.method == 'OPTIONS':
            logging.info(f"🔍 token_required: Allowing OPTIONS request to {request.path}")
            from flask import make_response
            return make_response('', 200)
        
        logging.info(f"🔍 token_required: Checking auth for {request.method} {request.path}")
        
        token = None
        
        # Get token from header
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token = auth_header.split(" ")[1]  # Bearer <token>
                logging.info(f"🔍 token_required: Token found in Authorization header")
            except IndexError:
                logging.error(f"❌ token_required: Invalid token format")
                return jsonify({'error': 'Invalid token format'}), 401
        
        if not token:
            logging.error(f"❌ token_required: Token is missing")
            return jsonify({'error': 'Token is missing'}), 401
        
        # Decode token
        payload = decode_token(token)
        if payload is None:
            logging.error(f"❌ token_required: Token is invalid or expired")
            return jsonify({'error': 'Token is invalid or expired'}), 401
        
        logging.info(f"✅ token_required: Token valid for user {payload.get('username')}")
        
        # Get user data
        user_model = User()
        current_user = user_model.find_by_id(payload['user_id'])
        
        # If user not found in database but token is valid, create a temporary user object
        if not current_user:
            # Check if this might be a demo user or database connection issue
            if payload.get('username') == 'demo':
                current_user = {
                    '_id': payload['user_id'],
                    'id': payload['user_id'],
                    'username': payload['username'],
                    'email': 'demo@example.com',
                    'created_at': datetime.utcnow(),
                    'is_active': True
                }
            else:
                logging.error(f"❌ token_required: User not found for user_id {payload['user_id']}")
                return jsonify({'error': 'User not found'}), 401
        
        # Remove password from user data and ensure id field exists
        current_user.pop('password', None)
        if '_id' in current_user and 'id' not in current_user:
            current_user['id'] = str(current_user['_id'])
        
        request.current_user = current_user
        
        # DON'T pass current_user - keep original behavior for existing routes
        return f(*args, **kwargs)
    
    return decorated


def token_required_with_user(f):
    """Decorator to require valid JWT token AND pass current_user to function"""
    @wraps(f)
    def decorated(*args, **kwargs):
        # Allow OPTIONS requests (CORS preflight) without authentication
        # Return empty 200 response - the after_request handler will add CORS headers
        if request.method == 'OPTIONS':
            from flask import make_response
            return make_response('', 200)
        
        token = None
        
        # Get token from header
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token = auth_header.split(" ")[1]  # Bearer <token>
            except IndexError:
                return jsonify({'error': 'Invalid token format'}), 401
        
        if not token:
            return jsonify({'error': 'Token is missing'}), 401
        
        # Decode token
        payload = decode_token(token)
        if payload is None:
            return jsonify({'error': 'Token is invalid or expired'}), 401
        
        # Get user data
        user_model = User()
        current_user = user_model.find_by_id(payload['user_id'])
        
        # If user not found in database but token is valid, create a temporary user object
        if not current_user:
            # Check if this might be a demo user or database connection issue
            if payload.get('username') == 'demo':
                current_user = {
                    '_id': payload['user_id'],
                    'id': payload['user_id'],
                    'username': payload['username'],
                    'email': 'demo@example.com',
                    'created_at': datetime.utcnow(),
                    'is_active': True
                }
            else:
                return jsonify({'error': 'User not found'}), 401
        
        # Remove password from user data and ensure id field exists
        current_user.pop('password', None)
        if '_id' in current_user and 'id' not in current_user:
            current_user['id'] = str(current_user['_id'])
        
        request.current_user = current_user
        
        # Pass current_user as first argument to the function
        return f(current_user, *args, **kwargs)
    
    return decorated


def admin_required(f):
    """Decorator to require admin role"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user = getattr(request, 'current_user', None)
        if not user or user.get('role') != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
        # Don't pass current_user - it's already in args if using token_required_with_user
        return f(*args, **kwargs)
    return decorated_function


def subadmin_or_admin_required(tab_name):
    """
    Decorator to require admin or subadmin with permission for specific tab
    Admin users bypass all permission checks
    Subadmin users must have permission for the specified tab
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            user = getattr(request, 'current_user', None)
            if not user:
                return jsonify({'error': 'Authentication required'}), 401
            
            user_role = user.get('role')
            
            # Admin has full access
            if user_role == 'admin':
                return f(*args, **kwargs)
            
            # Subadmin needs permission check
            if user_role == 'subadmin':
                from models.subadmin_permissions import SubadminPermissions
                permissions_model = SubadminPermissions()
                
                user_id = str(user['_id'])
                has_permission = permissions_model.check_permission(user_id, tab_name)
                
                if has_permission:
                    return f(*args, **kwargs)
                else:
                    return jsonify({'error': f'Access denied. You do not have permission to access {tab_name}'}), 403
            
            # Other roles don't have access
            return jsonify({'error': 'Admin or subadmin access required'}), 403
        
        return decorated_function
    return decorator


def admin_only_required(f):
    """
    Decorator to require strict admin role (no subadmin access)
    Use for sensitive operations like user management, subadmin creation, etc.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user = getattr(request, 'current_user', None)
        if not user or user.get('role') != 'admin':
            return jsonify({'error': 'Admin-only access required'}), 403
        return f(*args, **kwargs)
    return decorated_function
