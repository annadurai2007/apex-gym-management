import jwt
import datetime
from functools import wraps
from flask import request, jsonify
from backend.config import Config
from backend.database import query_db

def generate_jwt_token(user):
    """Generate JWT token with user id, email, and role."""
    expiration = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=Config.JWT_EXPIRES_HOURS)
    payload = {
        'user_id': user['id'],
        'email': user['email'],
        'role': user['role'],
        'exp': expiration,
        'iat': datetime.datetime.now(datetime.timezone.utc)
    }
    return jwt.encode(payload, Config.JWT_SECRET_KEY, algorithm='HS256')

def token_required(f):
    """Decorator to require a valid Bearer JWT token."""
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({'success': False, 'message': 'Authorization token is missing'}), 401

        parts = auth_header.split()
        if len(parts) != 2 or parts[0].lower() != 'bearer':
            return jsonify({'success': False, 'message': 'Invalid token format. Format: Bearer <token>'}), 401

        token = parts[1]
        try:
            payload = jwt.decode(token, Config.JWT_SECRET_KEY, algorithms=['HS256'])
            user = query_db("SELECT id, email, role, status FROM users WHERE id = %s", (payload['user_id'],), one=True)
            if not user or user['status'] != 'active':
                return jsonify({'success': False, 'message': 'User account is inactive or not found'}), 401
            
            # If user is a member or trainer, attach their member/trainer profile ID
            if user['role'] == 'member':
                member_profile = query_db("SELECT id, member_code, full_name, photo_url, status FROM members WHERE user_id = %s", (user['id'],), one=True)
                user['member'] = member_profile
            elif user['role'] in ('trainer', 'staff'):
                trainer_profile = query_db("SELECT id, full_name, photo_url, specialization FROM trainers WHERE user_id = %s", (user['id'],), one=True)
                user['trainer'] = trainer_profile

            request.current_user = user
        except jwt.ExpiredSignatureError:
            return jsonify({'success': False, 'message': 'Token has expired. Please log in again.'}), 401
        except (jwt.InvalidTokenError, Exception) as e:
            return jsonify({'success': False, 'message': f'Invalid token: {str(e)}'}), 401

        return f(*args, **kwargs)
    return decorated

def role_required(allowed_roles):
    """Decorator to restrict endpoint to specified roles."""
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            if not hasattr(request, 'current_user'):
                return jsonify({'success': False, 'message': 'Unauthorized access'}), 401
            
            user_role = request.current_user.get('role')
            if user_role not in allowed_roles:
                return jsonify({
                    'success': False, 
                    'message': f"Access denied. Requires one of roles: {', '.join(allowed_roles)}"
                }), 403
                
            return f(*args, **kwargs)
        return decorated
    return decorator
