import os
import datetime
from werkzeug.utils import secure_filename
from werkzeug.security import generate_password_hash
from flask import Blueprint, request, current_app
from backend.database import query_db
from backend.utils.auth_middleware import token_required, role_required
from backend.utils.helpers import (
    success_response, error_response, generate_member_code, 
    generate_invoice_no, allowed_file
)
from backend.config import Config

member_bp = Blueprint('members', __name__, url_prefix='/api/members')

@member_bp.route('', methods=['GET'])
@token_required
@role_required(['admin', 'staff', 'trainer'])
def list_members():
    """List members with search, status filtering, and pagination."""
    page = int(request.args.get('page', 1))
    limit = int(request.args.get('limit', 10))
    search = request.args.get('search', '').strip()
    status = request.args.get('status', '').strip()
    offset = (page - 1) * limit

    where_clauses = ["1=1"]
    params = []

    if search:
        where_clauses.append("(m.full_name LIKE %s OR m.email LIKE %s OR m.phone LIKE %s OR m.member_code LIKE %s)")
        like_search = f"%{search}%"
        params.extend([like_search, like_search, like_search, like_search])

    if status and status != 'all':
        where_clauses.append("m.status = %s")
        params.append(status)

    where_sql = " AND ".join(where_clauses)

    # Count total
    count_sql = f"SELECT COUNT(*) as total FROM members m WHERE {where_sql}"
    total_row = query_db(count_sql, tuple(params), one=True)
    total = total_row['total'] if total_row else 0

    # Fetch paginated rows with membership and trainer info
    query_sql = f"""
        SELECT 
            m.id, m.member_code, m.full_name, m.email, m.phone, m.gender,
            m.date_of_birth, m.emergency_contact, m.photo_url, m.joining_date, m.status,
            p.name as current_plan,
            ms.end_date as plan_expiry,
            ms.status as membership_status,
            t.full_name as trainer_name
        FROM members m
        LEFT JOIN memberships ms ON m.id = ms.member_id AND ms.status = 'active'
        LEFT JOIN membership_plans p ON ms.plan_id = p.id
        LEFT JOIN trainer_assignments ta ON m.id = ta.member_id AND ta.status = 'active'
        LEFT JOIN trainers t ON ta.trainer_id = t.id
        WHERE {where_sql}
        ORDER BY m.id DESC
        LIMIT %s OFFSET %s
    """
    params.extend([limit, offset])
    members = query_db(query_sql, tuple(params))

    return success_response(
        data=members,
        pagination={
            'page': page,
            'limit': limit,
            'total': total,
            'pages': (total + limit - 1) // limit if total > 0 else 1
        },
        message='Members retrieved'
    )

@member_bp.route('/<int:member_id>', methods=['GET'])
@token_required
def get_member(member_id):
    """Get full member profile details including memberships, payments, and workouts."""
    # Member role can only view their own profile
    if request.current_user['role'] == 'member':
        member_rec = query_db("SELECT id FROM members WHERE user_id = %s", (request.current_user['id'],), one=True)
        if not member_rec or member_rec['id'] != member_id:
            return error_response('Access forbidden: cannot view other member profiles', status_code=403)

    member = query_db("""
        SELECT m.*, u.email as user_email
        FROM members m
        LEFT JOIN users u ON m.user_id = u.id
        WHERE m.id = %s
    """, (member_id,), one=True)

    if not member:
        return error_response('Member not found', status_code=404)

    # Fetch memberships history
    memberships = query_db("""
        SELECT ms.*, p.name as plan_name, p.duration_months
        FROM memberships ms
        JOIN membership_plans p ON ms.plan_id = p.id
        WHERE ms.member_id = %s
        ORDER BY ms.id DESC
    """, (member_id,))

    # Fetch assigned trainer
    trainer = query_db("""
        SELECT t.id, t.full_name, t.specialization, t.phone, t.email, t.photo_url, ta.assigned_date
        FROM trainer_assignments ta
        JOIN trainers t ON ta.trainer_id = t.id
        WHERE ta.member_id = %s AND ta.status = 'active'
        ORDER BY ta.id DESC LIMIT 1
    """, (member_id,), one=True)

    # Fetch recent attendance
    attendance = query_db("""
        SELECT * FROM attendance
        WHERE member_id = %s
        ORDER BY date DESC LIMIT 10
    """, (member_id,))

    # Fetch recent payments
    payments = query_db("""
        SELECT * FROM payments
        WHERE member_id = %s
        ORDER BY payment_date DESC LIMIT 10
    """, (member_id,))

    # Fetch active workout plan
    workout_plan = query_db("""
        SELECT wp.*, mwa.assigned_date
        FROM member_workout_assignments mwa
        JOIN workout_plans wp ON mwa.plan_id = wp.id
        WHERE mwa.member_id = %s AND mwa.status = 'active'
        ORDER BY mwa.id DESC LIMIT 1
    """, (member_id,), one=True)

    # Fetch active diet plan
    diet_plan = query_db("""
        SELECT dp.*, mda.assigned_date
        FROM member_diet_assignments mda
        JOIN diet_plans dp ON mda.plan_id = dp.id
        WHERE mda.member_id = %s AND mda.status = 'active'
        ORDER BY mda.id DESC LIMIT 1
    """, (member_id,), one=True)

    member_data = {
        **member,
        'memberships': memberships,
        'trainer': trainer,
        'recent_attendance': attendance,
        'recent_payments': payments,
        'workout_plan': workout_plan,
        'diet_plan': diet_plan
    }

    return success_response(data=member_data, message='Member profile retrieved')

@member_bp.route('', methods=['POST'])
@token_required
@role_required(['admin', 'staff', 'trainer'])
def create_member():
    """Register a new member with user account, initial plan, and optional payment record."""
    data = request.get_json(silent=True) or {}
    full_name = data.get('full_name', '').strip()
    email = data.get('email', '').strip().lower()
    phone = data.get('phone', '').strip()
    gender = data.get('gender', 'male')
    dob = data.get('date_of_birth') or None
    emergency_contact = data.get('emergency_contact', '').strip()
    address = data.get('address', '').strip()
    photo_url = data.get('photo_url', '').strip() or 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80'
    plan_id = data.get('plan_id')
    trainer_id = data.get('trainer_id')
    password = data.get('password', 'Member@123')

    if not full_name or not email or not phone:
        return error_response('Full name, email, and phone number are required', status_code=400)

    # Check if email is already taken
    existing_user = query_db("SELECT id FROM users WHERE email = %s", (email,), one=True)
    if existing_user:
        return error_response('An account with this email already exists', status_code=400)

    # Create user record
    password_hash = generate_password_hash(password)
    user_res = query_db(
        "INSERT INTO users (email, password_hash, role, status) VALUES (%s, %s, 'member', 'active')",
        (email, password_hash),
        commit=True
    )
    user_id = user_res['lastrowid']

    # Create member record
    member_code = generate_member_code()
    today = datetime.date.today()
    member_res = query_db("""
        INSERT INTO members 
        (user_id, member_code, full_name, email, phone, gender, date_of_birth, emergency_contact, address, photo_url, joining_date, status)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'active')
    """, (user_id, member_code, full_name, email, phone, gender, dob, emergency_contact, address, photo_url, today), commit=True)
    
    member_id = member_res['lastrowid']

    # If initial plan is chosen, create membership and payment
    if plan_id:
        plan = query_db("SELECT * FROM membership_plans WHERE id = %s", (plan_id,), one=True)
        if plan:
            duration_months = int(plan['duration_months'])
            # Approximate end date (+30 days * duration_months)
            end_date = today + datetime.timedelta(days=30 * duration_months)
            
            ms_res = query_db("""
                INSERT INTO memberships (member_id, plan_id, start_date, end_date, price_paid, status, auto_renew)
                VALUES (%s, %s, %s, %s, %s, 'active', FALSE)
            """, (member_id, plan['id'], today, end_date, plan['price']), commit=True)
            membership_id = ms_res['lastrowid']

            # Record payment
            invoice_no = generate_invoice_no()
            query_db("""
                INSERT INTO payments 
                (member_id, membership_id, invoice_no, amount, payment_date, payment_method, transaction_id, status, notes)
                VALUES (%s, %s, %s, %s, %s, 'card', %s, 'paid', %s)
            """, (member_id, membership_id, invoice_no, plan['price'], today, f"TXN_{member_code}_{invoice_no[-4:]}", f"Initial {plan['name']} membership"), commit=True)

    # If trainer is assigned
    if trainer_id:
        query_db("""
            INSERT INTO trainer_assignments (member_id, trainer_id, assigned_date, status, notes)
            VALUES (%s, %s, %s, 'active', 'Assigned upon registration')
        """, (member_id, trainer_id, today), commit=True)

    # Create welcome notification
    query_db("""
        INSERT INTO notifications (user_id, title, message, type)
        VALUES (%s, 'Welcome to APEX Fitness', 'Your membership account is now active. Explore your dashboard to view workout and diet plans.', 'success')
    """, (user_id,), commit=True)

    return success_response(
        data={'member_id': member_id, 'member_code': member_code},
        message=f'Member {full_name} registered successfully',
        status_code=201
    )

@member_bp.route('/<int:member_id>', methods=['PUT'])
@token_required
def update_member(member_id):
    """Update member profile details."""
    data = request.get_json(silent=True) or {}
    
    # Check permissions
    if request.current_user['role'] == 'member':
        member_rec = query_db("SELECT id FROM members WHERE user_id = %s", (request.current_user['id'],), one=True)
        if not member_rec or member_rec['id'] != member_id:
            return error_response('Access denied', status_code=403)
        # Members can only update certain fields
        phone = data.get('phone')
        emergency_contact = data.get('emergency_contact')
        address = data.get('address')
        query_db("""
            UPDATE members 
            SET phone = COALESCE(%s, phone),
                emergency_contact = COALESCE(%s, emergency_contact),
                address = COALESCE(%s, address)
            WHERE id = %s
        """, (phone, emergency_contact, address, member_id), commit=True)
        return success_response(message='Profile updated successfully')

    # Admin / Staff update
    full_name = data.get('full_name')
    phone = data.get('phone')
    gender = data.get('gender')
    dob = data.get('date_of_birth')
    emergency_contact = data.get('emergency_contact')
    address = data.get('address')
    status = data.get('status')
    photo_url = data.get('photo_url')

    query_db("""
        UPDATE members 
        SET full_name = COALESCE(%s, full_name),
            phone = COALESCE(%s, phone),
            gender = COALESCE(%s, gender),
            date_of_birth = COALESCE(%s, date_of_birth),
            emergency_contact = COALESCE(%s, emergency_contact),
            address = COALESCE(%s, address),
            status = COALESCE(%s, status),
            photo_url = COALESCE(%s, photo_url)
        WHERE id = %s
    """, (full_name, phone, gender, dob, emergency_contact, address, status, photo_url, member_id), commit=True)

    return success_response(message='Member updated successfully')

@member_bp.route('/<int:member_id>', methods=['DELETE'])
@token_required
@role_required(['admin'])
def delete_member(member_id):
    """Delete member account with confirmation."""
    member = query_db("SELECT user_id, full_name FROM members WHERE id = %s", (member_id,), one=True)
    if not member:
        return error_response('Member not found', status_code=404)

    # Delete member (cascades to memberships, attendance, assignments, payments)
    query_db("DELETE FROM members WHERE id = %s", (member_id,), commit=True)
    if member['user_id']:
        query_db("DELETE FROM users WHERE id = %s", (member['user_id'],), commit=True)

    return success_response(message=f"Member {member['full_name']} deleted successfully")

@member_bp.route('/<int:member_id>/photo', methods=['POST'])
@token_required
def upload_photo(member_id):
    """Upload or update profile photo."""
    # Check permissions
    if request.current_user['role'] == 'member':
        member_rec = query_db("SELECT id FROM members WHERE user_id = %s", (request.current_user['id'],), one=True)
        if not member_rec or member_rec['id'] != member_id:
            return error_response('Access denied', status_code=403)

    if 'file' in request.files:
        file = request.files['file']
        if file.filename == '':
            return error_response('No file selected', status_code=400)
        if file and allowed_file(file.filename):
            os.makedirs(Config.UPLOAD_FOLDER, exist_ok=True)
            ext = file.filename.rsplit('.', 1)[1].lower()
            filename = f"member_{member_id}_{int(datetime.datetime.now().timestamp())}.{ext}"
            filepath = os.path.join(Config.UPLOAD_FOLDER, filename)
            file.save(filepath)
            photo_url = f"/uploads/{filename}"
            query_db("UPDATE members SET photo_url = %s WHERE id = %s", (photo_url, member_id), commit=True)
            return success_response(data={'photo_url': photo_url}, message='Photo uploaded successfully')
        else:
            return error_response('Invalid image format. Allowed: JPG, PNG, WEBP', status_code=400)

    # Alternatively accept a photo_url JSON body
    data = request.get_json(silent=True) or {}
    photo_url = data.get('photo_url')
    if photo_url:
        query_db("UPDATE members SET photo_url = %s WHERE id = %s", (photo_url, member_id), commit=True)
        return success_response(data={'photo_url': photo_url}, message='Photo URL updated successfully')

    return error_response('No file or photo URL provided', status_code=400)

@member_bp.route('/badges', methods=['GET'])
@token_required
@role_required(['admin', 'staff', 'trainer'])
def get_member_badges_route():
    """Retrieve active members/students with QR payloads for printable ID passes."""
    members = query_db("""
        SELECT m.id, m.member_code, m.full_name, m.email, m.phone, m.photo_url, m.status,
               p.name as plan_name
        FROM members m
        LEFT JOIN memberships ms ON m.id = ms.member_id AND ms.status = 'active'
        LEFT JOIN membership_plans p ON ms.plan_id = p.id
        WHERE m.status = 'active'
        ORDER BY m.id ASC
    """)
    for m in members:
        m['qr_payload'] = f"APEX:MEMBER:{m['member_code']}"
    return success_response(data=members, message="Member badges retrieved")
