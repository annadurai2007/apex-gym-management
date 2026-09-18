from flask import Blueprint, request
from werkzeug.security import check_password_hash, generate_password_hash
from backend.database import query_db
from backend.utils.auth_middleware import generate_jwt_token, token_required, get_role_permissions
from backend.utils.helpers import success_response, error_response

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')

@auth_bp.route('/login', methods=['POST'])
def login():
    """Authenticate user with email and password, return JWT token and profile."""
    data = request.get_json(silent=True) or {}
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not email or not password:
        return error_response('Email and password are required', status_code=400)

    user = query_db(
        "SELECT id, email, password_hash, role, status FROM users WHERE email = %s", 
        (email,), 
        one=True
    )

    if not user:
        return error_response('Invalid credentials. User not found.', status_code=401)

    if user['status'] != 'active':
        return error_response(f"Account is {user['status']}. Please contact management.", status_code=403)

    if not check_password_hash(user['password_hash'], password):
        return error_response('Invalid credentials. Password incorrect.', status_code=401)

    # Attach profile data depending on role
    profile = None
    if user['role'] == 'member':
        profile = query_db(
            """SELECT m.*, p.name as plan_name, ms.status as membership_status, ms.end_date as plan_expiry
               FROM members m
               LEFT JOIN memberships ms ON m.id = ms.member_id AND ms.status = 'active'
               LEFT JOIN membership_plans p ON ms.plan_id = p.id
               WHERE m.user_id = %s
               ORDER BY ms.id DESC LIMIT 1""",
            (user['id'],),
            one=True
        )
    elif user['role'] in ('trainer', 'staff'):
        profile = query_db(
            "SELECT * FROM trainers WHERE user_id = %s",
            (user['id'],),
            one=True
        )

    token = generate_jwt_token(user)
    permissions = get_role_permissions(user['role'])

    user_info = {
        'id': user['id'],
        'email': user['email'],
        'role': user['role'],
        'status': user['status'],
        'profile': profile,
        'permissions': permissions
    }

    return success_response(
        data={'token': token, 'user': user_info},
        message='Login successful'
    )

@auth_bp.route('/me', methods=['GET'])
@token_required
def get_current_user():
    """Get authenticated user info."""
    user = request.current_user
    profile = None
    if user['role'] == 'member':
        profile = query_db(
            """SELECT m.*, p.name as plan_name, ms.id as membership_id, ms.status as membership_status, 
                      ms.start_date, ms.end_date as plan_expiry, ms.auto_renew,
                      t.full_name as trainer_name, t.photo_url as trainer_photo, t.phone as trainer_phone,
                      t.specialization as trainer_specialization
               FROM members m
               LEFT JOIN memberships ms ON m.id = ms.member_id AND ms.status = 'active'
               LEFT JOIN membership_plans p ON ms.plan_id = p.id
               LEFT JOIN trainer_assignments ta ON m.id = ta.member_id AND ta.status = 'active'
               LEFT JOIN trainers t ON ta.trainer_id = t.id
               WHERE m.user_id = %s
               ORDER BY ms.id DESC LIMIT 1""",
            (user['id'],),
            one=True
        )
    elif user['role'] in ('trainer', 'staff'):
        profile = query_db(
            "SELECT * FROM trainers WHERE user_id = %s",
            (user['id'],),
            one=True
        )

    permissions = get_role_permissions(user['role'])

    return success_response(
        data={
            'id': user['id'],
            'email': user['email'],
            'role': user['role'],
            'status': user['status'],
            'profile': profile,
            'permissions': permissions
        },
        message='Profile loaded'
    )

@auth_bp.route('/permissions', methods=['GET'])
@token_required
def get_permissions():
    """Retrieve all available permissions and current role assignments."""
    from backend.utils.auth_middleware import ALL_PERMISSIONS
    
    # Query matrix from database
    rows = query_db("SELECT role, permission_key, is_granted FROM role_permissions")
    matrix = {'admin': {}, 'staff': {}, 'trainer': {}, 'member': {}}
    for r in rows:
        matrix.setdefault(r['role'], {})[r['permission_key']] = bool(r['is_granted'])

    # Ensure admin has all permissions as True
    for p in ALL_PERMISSIONS:
        matrix['admin'][p['key']] = True

    return success_response(
        data={
            'definitions': ALL_PERMISSIONS,
            'matrix': matrix,
            'user_permissions': get_role_permissions(request.current_user['role'])
        },
        message='Permissions matrix retrieved'
    )

@auth_bp.route('/permissions', methods=['PUT'])
@token_required
def update_permissions():
    """Update role permissions matrix (Admin Only)."""
    if request.current_user['role'] != 'admin':
        return error_response('Only administrators can configure role permissions', status_code=403)

    data = request.get_json(silent=True) or {}
    matrix = data.get('matrix') or {}

    for role, perms in matrix.items():
        if role not in ('staff', 'trainer', 'member'):
            continue  # Admin permissions cannot be altered

        for perm_key, is_granted in perms.items():
            val = 1 if is_granted else 0
            existing = query_db(
                "SELECT id FROM role_permissions WHERE role = %s AND permission_key = %s",
                (role, perm_key),
                one=True
            )
            if existing:
                query_db(
                    "UPDATE role_permissions SET is_granted = %s WHERE id = %s",
                    (val, existing['id']),
                    commit=True
                )
            else:
                query_db(
                    "INSERT INTO role_permissions (role, permission_key, is_granted) VALUES (%s, %s, %s)",
                    (role, perm_key, val),
                    commit=True
                )

    return success_response(message='Role permissions updated successfully')

@auth_bp.route('/change-password', methods=['POST'])
@token_required
def change_password():
    """Change authenticated user password."""
    data = request.get_json(silent=True) or {}
    old_pass = data.get('current_password')
    new_pass = data.get('new_password')

    if not old_pass or not new_pass:
        return error_response('Current password and new password are required', status_code=400)

    if len(new_pass) < 6:
        return error_response('New password must be at least 6 characters', status_code=400)

    user_row = query_db("SELECT password_hash FROM users WHERE id = %s", (request.current_user['id'],), one=True)
    if not check_password_hash(user_row['password_hash'], old_pass):
        return error_response('Current password is incorrect', status_code=400)

    new_hash = generate_password_hash(new_pass)
    query_db("UPDATE users SET password_hash = %s WHERE id = %s", (new_hash, request.current_user['id']), commit=True)

    return success_response(message='Password updated successfully')
