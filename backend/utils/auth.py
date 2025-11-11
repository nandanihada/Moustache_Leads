import jwt
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
        
        return f(*args, **kwargs)
    
    return decorated

def admin_required(f):
    """Decorator to require admin role"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user = getattr(request, 'current_user', None)
        if not user or user.get('role') != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
        return f(*args, **kwargs)
    return decorated_function
