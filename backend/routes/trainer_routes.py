from flask import Blueprint, request
from werkzeug.security import generate_password_hash
from backend.database import query_db
from backend.utils.auth_middleware import token_required, role_required
from backend.utils.helpers import success_response, error_response

trainer_bp = Blueprint('trainers', __name__, url_prefix='/api/trainers')

@trainer_bp.route('', methods=['GET'])
def list_trainers():
    """List trainers with search, filter, and member counts."""
    search = request.args.get('search', '').strip()
    status = request.args.get('status', 'active').strip()

    where_clauses = ["1=1"]
    params = []

    if status and status != 'all':
        where_clauses.append("t.status = %s")
        params.append(status)

    if search:
        where_clauses.append("(t.full_name LIKE %s OR t.specialization LIKE %s OR t.email LIKE %s)")
        like_term = f"%{search}%"
        params.extend([like_term, like_term, like_term])

    where_sql = " AND ".join(where_clauses)

    query_sql = f"""
        SELECT 
            t.*,
            COUNT(ta.id) as assigned_members_count
        FROM trainers t
        LEFT JOIN trainer_assignments ta ON t.id = ta.trainer_id AND ta.status = 'active'
        WHERE {where_sql}
        GROUP BY t.id
        ORDER BY t.id ASC
    """
    trainers = query_db(query_sql, tuple(params))
    return success_response(data=trainers, message='Trainers retrieved')

@trainer_bp.route('/<int:trainer_id>', methods=['GET'])
def get_trainer(trainer_id):
    """Get single trainer profile with assigned members."""
    trainer = query_db("SELECT * FROM trainers WHERE id = %s", (trainer_id,), one=True)
    if not trainer:
        return error_response('Trainer not found', status_code=404)

    # Assigned members
    assigned_members = query_db("""
        SELECT m.id, m.member_code, m.full_name, m.email, m.phone, m.photo_url,
               ta.assigned_date, ta.notes
        FROM trainer_assignments ta
        JOIN members m ON ta.member_id = m.id
        WHERE ta.trainer_id = %s AND ta.status = 'active'
    """, (trainer_id,))

    trainer['assigned_members'] = assigned_members
    return success_response(data=trainer, message='Trainer profile retrieved')

@trainer_bp.route('', methods=['POST'])
@token_required
@role_required(['admin'])
def create_trainer():
    """Add a new trainer."""
    data = request.get_json(silent=True) or {}
    full_name = data.get('full_name', '').strip()
    email = data.get('email', '').strip().lower()
    phone = data.get('phone', '').strip()
    specialization = data.get('specialization', '').strip()
    experience_years = int(data.get('experience_years', 1))
    bio = data.get('bio', '').strip()
    schedule = data.get('schedule', 'Mon-Fri: 08:00 - 16:00')
    photo_url = data.get('photo_url') or 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80'
    password = data.get('password', 'Trainer@123')

    if not full_name or not email or not phone or not specialization:
        return error_response('Name, email, phone, and specialization are required', status_code=400)

    # Create user account if doesn't exist
    existing_user = query_db("SELECT id FROM users WHERE email = %s", (email,), one=True)
    if existing_user:
        user_id = existing_user['id']
    else:
        pw_hash = generate_password_hash(password)
        res = query_db(
            "INSERT INTO users (email, password_hash, role, status) VALUES (%s, %s, 'trainer', 'active')",
            (email, pw_hash), commit=True
        )
        user_id = res['lastrowid']

    trainer_res = query_db("""
        INSERT INTO trainers 
        (user_id, full_name, email, phone, specialization, experience_years, bio, schedule, photo_url, status)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'active')
    """, (user_id, full_name, email, phone, specialization, experience_years, bio, schedule, photo_url), commit=True)

    return success_response(
        data={'trainer_id': trainer_res['lastrowid']},
        message=f'Trainer {full_name} added successfully',
        status_code=201
    )

@trainer_bp.route('/<int:trainer_id>', methods=['PUT'])
@token_required
@role_required(['admin'])
def update_trainer(trainer_id):
    """Update trainer details."""
    data = request.get_json(silent=True) or {}
    full_name = data.get('full_name')
    phone = data.get('phone')
    specialization = data.get('specialization')
    experience_years = data.get('experience_years')
    bio = data.get('bio')
    schedule = data.get('schedule')
    status = data.get('status')
    photo_url = data.get('photo_url')

    query_db("""
        UPDATE trainers
        SET full_name = COALESCE(%s, full_name),
            phone = COALESCE(%s, phone),
            specialization = COALESCE(%s, specialization),
            experience_years = COALESCE(%s, experience_years),
            bio = COALESCE(%s, bio),
            schedule = COALESCE(%s, schedule),
            status = COALESCE(%s, status),
            photo_url = COALESCE(%s, photo_url)
        WHERE id = %s
    """, (full_name, phone, specialization, experience_years, bio, schedule, status, photo_url, trainer_id), commit=True)

    return success_response(message='Trainer updated successfully')

@trainer_bp.route('/<int:trainer_id>', methods=['DELETE'])
@token_required
@role_required(['admin'])
def delete_trainer(trainer_id):
    """Deactivate or remove trainer."""
    trainer = query_db("SELECT id, full_name FROM trainers WHERE id = %s", (trainer_id,), one=True)
    if not trainer:
        return error_response('Trainer not found', status_code=404)

    query_db("UPDATE trainers SET status = 'inactive' WHERE id = %s", (trainer_id,), commit=True)
    return success_response(message=f"Trainer {trainer['full_name']} deactivated successfully")

@trainer_bp.route('/assign', methods=['POST'])
@token_required
@role_required(['admin', 'staff'])
def assign_member():
    """Assign or reassign a member to a trainer."""
    data = request.get_json(silent=True) or {}
    member_id = data.get('member_id')
    trainer_id = data.get('trainer_id')
    notes = data.get('notes', '')

    if not member_id or not trainer_id:
        return error_response('Member ID and Trainer ID are required', status_code=400)

    # Complete/deactivate old assignments
    query_db("UPDATE trainer_assignments SET status = 'completed' WHERE member_id = %s", (member_id,), commit=True)

    import datetime
    today = datetime.date.today()
    query_db("""
        INSERT INTO trainer_assignments (member_id, trainer_id, assigned_date, status, notes)
        VALUES (%s, %s, %s, 'active', %s)
    """, (member_id, trainer_id, today, notes), commit=True)

    return success_response(message='Trainer assigned successfully')

@trainer_bp.route('/badges', methods=['GET'])
@token_required
@role_required(['admin', 'staff', 'trainer'])
def get_trainer_badges():
    """Retrieve all active trainers with their QR payloads for printable ID badges."""
    trainers = query_db("""
        SELECT id, trainer_code, full_name, email, phone, specialization, photo_url, status
        FROM trainers
        WHERE status = 'active'
        ORDER BY id ASC
    """)
    for t in trainers:
        t['qr_payload'] = f"APEX:TRAINER:{t['trainer_code']}"
    return success_response(data=trainers, message="Trainer badges retrieved")
