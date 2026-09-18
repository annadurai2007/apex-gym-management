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

ALL_PERMISSIONS = [
    # Members Management
    {"key": "members:view", "name": "View Member Directory", "category": "Members & Athletes", "desc": "Search and inspect athlete dossiers"},
    {"key": "members:create", "name": "Register New Members", "category": "Members & Athletes", "desc": "Onboard new athletes into the system"},
    {"key": "members:edit", "name": "Update Member Profiles", "category": "Members & Athletes", "desc": "Modify athlete bio, phone, emergency contacts"},
    {"key": "members:delete", "name": "Delete Member Records", "category": "Members & Athletes", "desc": "Permanently remove athlete accounts"},

    # Attendance & Front Desk
    {"key": "attendance:view", "name": "View Attendance Logs", "category": "Front Desk & Attendance", "desc": "Access daily roll-call and live active roster"},
    {"key": "attendance:checkin", "name": "Check-In / Roll-Call", "category": "Front Desk & Attendance", "desc": "Scan QR codes and record present/absent roll-call"},
    {"key": "attendance:checkout", "name": "Check-Out Clock", "category": "Front Desk & Attendance", "desc": "Log out-time timestamps"},
    {"key": "attendance:edit", "name": "Modify Attendance Records", "category": "Front Desk & Attendance", "desc": "Correct timestamps and status retroactively"},
    {"key": "badges:view", "name": "Print Digital Passes", "category": "Front Desk & Attendance", "desc": "Generate and print turnstile QR identity passes"},

    # Trainers & Shifts
    {"key": "trainers:view", "name": "View Coach Directory", "category": "Trainers & Coaches", "desc": "Browse coach profiles and specializations"},
    {"key": "trainers:manage", "name": "Manage Coach Profiles", "category": "Trainers & Coaches", "desc": "Add or modify coach contracts and details"},
    {"key": "trainer_attendance:manage", "name": "Trainer Shift Turnstile", "category": "Trainers & Coaches", "desc": "Operate coach QR in/out shift recording"},

    # Subscriptions & Billing
    {"key": "plans:view", "name": "View Membership Plans", "category": "Billing & Subscriptions", "desc": "Inspect plan tiers and pricing structures"},
    {"key": "plans:manage", "name": "Modify Plan Packages", "category": "Billing & Subscriptions", "desc": "Create, edit pricing, or toggle active tiers"},
    {"key": "payments:view", "name": "View Invoices & Payments", "category": "Billing & Subscriptions", "desc": "Access financial ledger and billing histories"},
    {"key": "payments:create", "name": "Record Payments & Invoices", "category": "Billing & Subscriptions", "desc": "Collect fees and generate invoice receipts"},

    # Workouts & Diets
    {"key": "workouts:view", "name": "View Workout Splits", "category": "Fitness Blueprints", "desc": "Browse workout routines and exercise templates"},
    {"key": "workouts:manage", "name": "Design & Assign Workouts", "category": "Fitness Blueprints", "desc": "Build routine splits and assign them to athletes"},
    {"key": "diets:view", "name": "View Nutrition Blueprints", "category": "Fitness Blueprints", "desc": "Browse meal timetables and macro calculations"},
    {"key": "diets:manage", "name": "Design & Assign Diets", "category": "Fitness Blueprints", "desc": "Create diet plans and assign them to athletes"},

    # Analytics & Governance
    {"key": "reports:view", "name": "View Revenue & Trends", "category": "Reports & Governance", "desc": "Inspect analytical charts and KPIs"},
    {"key": "reports:export", "name": "Export Audit CSVs", "category": "Reports & Governance", "desc": "Download accounting and attendance spreadsheets"},
    {"key": "roles:manage", "name": "Manage Role Permissions", "category": "Reports & Governance", "desc": "Configure access control matrix (Admin Only)"}
]

DEFAULT_STAFF_PERMISSIONS = {
    "members:view", "members:create", "members:edit",
    "attendance:view", "attendance:checkin", "attendance:checkout", "attendance:edit", "badges:view",
    "trainers:view", "trainer_attendance:manage",
    "plans:view",
    "payments:view", "payments:create",
    "workouts:view", "diets:view"
}

DEFAULT_TRAINER_PERMISSIONS = {
    "members:view",
    "attendance:view", "attendance:checkin", "attendance:checkout", "badges:view",
    "trainers:view", "trainer_attendance:manage",
    "plans:view",
    "workouts:view", "workouts:manage",
    "diets:view", "diets:manage"
}

def get_role_permissions(role):
    """Retrieve all granted permission keys for a given role."""
    if role == 'admin':
        return [p['key'] for p in ALL_PERMISSIONS]
    try:
        rows = query_db("SELECT permission_key FROM role_permissions WHERE role = %s AND is_granted = 1", (role,))
        if rows:
            return [r['permission_key'] for r in rows]
    except Exception:
        pass
    if role == 'staff':
        return list(DEFAULT_STAFF_PERMISSIONS)
    elif role == 'trainer':
        return list(DEFAULT_TRAINER_PERMISSIONS)
    return []

def has_permission(role, permission_key):
    """Check whether a role has a specific permission."""
    if role == 'admin':
        return True
    perms = get_role_permissions(role)
    return permission_key in perms

def permission_required(permission_key):
    """Decorator to restrict endpoint based on granular permission."""
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            if not hasattr(request, 'current_user'):
                return jsonify({'success': False, 'message': 'Unauthorized access'}), 401
            
            user_role = request.current_user.get('role')
            if not has_permission(user_role, permission_key):
                return jsonify({
                    'success': False,
                    'message': f"Access denied. Missing permission: '{permission_key}'"
                }), 403
            return f(*args, **kwargs)
        return decorated
    return decorator
