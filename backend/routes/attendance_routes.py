import datetime
from flask import Blueprint, request
from backend.database import query_db
from backend.utils.auth_middleware import token_required, role_required, permission_required
from backend.utils.helpers import success_response, error_response

attendance_bp = Blueprint('attendance', __name__, url_prefix='/api/attendance')

def format_time_field(val):
    if val is None:
        return None
    if isinstance(val, datetime.timedelta):
        total_seconds = int(val.total_seconds())
        hours = total_seconds // 3600
        minutes = (total_seconds % 3600) // 60
        seconds = total_seconds % 60
        return f"{hours:02d}:{minutes:02d}:{seconds:02d}"
    if isinstance(val, datetime.time):
        return val.strftime('%H:%M:%S')
    return str(val)

@attendance_bp.route('/check-in', methods=['POST'])
@token_required
@permission_required('attendance:checkin')
def check_in():
    """Check in a member for today with duplicate prevention and status verification."""
    data = request.get_json(silent=True) or {}
    member_id = data.get('member_id')
    member_code = data.get('member_code', '').strip().upper()
    if member_code.startswith('APEX:MEMBER:'):
        member_code = member_code.replace('APEX:MEMBER:', '')
    notes = data.get('notes', '')

    if not member_id and not member_code:
        return error_response('Member ID or Member Code is required', status_code=400)

    # Resolve member
    if member_id:
        member = query_db("SELECT id, full_name, member_code, status FROM members WHERE id = %s", (member_id,), one=True)
    else:
        member = query_db("SELECT id, full_name, member_code, status FROM members WHERE member_code = %s", (member_code,), one=True)

    if not member:
        return error_response('Member not found with given ID or code', status_code=404)

    if member['status'] == 'expired':
        return error_response(f"Check-in blocked: Member {member['full_name']} has an EXPIRED membership. Please renew first.", status_code=403)

    today = datetime.date.today().isoformat()
    now_time = datetime.datetime.now().strftime('%H:%M:%S')

    # Duplicate check-in check
    existing = query_db(
        "SELECT id, check_in_time, check_out_time, status FROM attendance WHERE member_id = %s AND date = %s",
        (member['id'], today),
        one=True
    )
    if existing and existing['status'] in ['present', 'completed']:
        action_verb = "already completed workout session" if existing['status'] == 'completed' else f"already checked in today at {existing['check_in_time']}"
        return error_response(
            f"Duplicate check-in prevented: {member['full_name']} {action_verb}",
            status_code=409
        )

    if existing and existing['status'] == 'absent':
        # Convert absent to present
        query_db("UPDATE attendance SET check_in_time = %s, status = 'present', notes = %s WHERE id = %s",
                 (now_time, notes or 'Marked Present via Check-In', existing['id']), commit=True)
        res_id = existing['id']
    else:
        res = query_db("""
            INSERT INTO attendance (member_id, date, check_in_time, status, notes)
            VALUES (%s, %s, %s, 'present', %s)
        """, (member['id'], today, now_time, notes), commit=True)
        res_id = res['lastrowid']

    return success_response(
        data={
            'attendance_id': res_id,
            'member_id': member['id'],
            'member_name': member['full_name'],
            'check_in_time': now_time
        },
        message=f"Check-in verified for {member['full_name']} at {now_time}"
    )

@attendance_bp.route('/scan', methods=['POST'])
@token_required
@permission_required('attendance:checkin')
def scan_member_qr():
    """Smart optical QR turnstile scanner for members/students:
       - First scan: In-Time (Status: present)
       - Second scan: Out-Time (Status: completed)
       - Subsequent scan: Already completed alert
    """
    data = request.get_json(silent=True) or {}
    raw_code = data.get('member_code', '').strip().upper()
    if raw_code.startswith('APEX:MEMBER:'):
        raw_code = raw_code.replace('APEX:MEMBER:', '')

    if not raw_code:
        return error_response('Member Code or QR payload is required', status_code=400)

    member = query_db("""
        SELECT m.id, m.member_code, m.full_name, m.photo_url, m.status,
               p.name as plan_name
        FROM members m
        LEFT JOIN memberships ms ON m.id = ms.member_id AND ms.status = 'active'
        LEFT JOIN membership_plans p ON ms.plan_id = p.id
        WHERE m.member_code = %s
    """, (raw_code,), one=True)

    if not member:
        return error_response(f"Member with code '{raw_code}' not found.", status_code=404)

    if member['status'] == 'expired':
        return error_response(f"Access Denied: Membership expired for {member['full_name']}.", status_code=403)

    today = datetime.date.today().isoformat()
    now_dt = datetime.datetime.now()
    now_time = now_dt.strftime('%H:%M:%S')
    display_time = now_dt.strftime('%I:%M:%S %p')

    existing = query_db("SELECT id, check_in_time, check_out_time, status FROM attendance WHERE member_id = %s AND date = %s",
                        (member['id'], today), one=True)

    if not existing or existing['status'] == 'absent':
        # Scan 1: Check In (In-Time)
        if existing:
            query_db("UPDATE attendance SET check_in_time = %s, status = 'present' WHERE id = %s", (now_time, existing['id']), commit=True)
            att_id = existing['id']
        else:
            res = query_db("INSERT INTO attendance (member_id, date, check_in_time, status, notes) VALUES (%s, %s, %s, 'present', 'QR Scan')",
                           (member['id'], today, now_time), commit=True)
            att_id = res['lastrowid']

        return success_response(
            data={
                'attendance_id': att_id,
                'member_id': member['id'],
                'member_code': member['member_code'],
                'full_name': member['full_name'],
                'photo_url': member['photo_url'],
                'plan_name': member['plan_name'] or 'Standard Tier',
                'action': 'check_in',
                'in_time': now_time,
                'out_time': None,
                'status': 'present',
                'formatted_time': display_time
            },
            message=f"CHECK-IN Recorded: {display_time} — Member {member['full_name']} marked PRESENT."
        )

    elif existing['check_out_time'] is None:
        # Scan 2: Check Out (Out-Time)
        in_time_str = format_time_field(existing['check_in_time'])
        query_db("UPDATE attendance SET check_out_time = %s WHERE id = %s", (now_time, existing['id']), commit=True)

        return success_response(
            data={
                'attendance_id': existing['id'],
                'member_id': member['id'],
                'member_code': member['member_code'],
                'full_name': member['full_name'],
                'photo_url': member['photo_url'],
                'plan_name': member['plan_name'] or 'Standard Tier',
                'action': 'check_out',
                'in_time': in_time_str,
                'out_time': now_time,
                'status': 'completed',
                'formatted_time': display_time
            },
            message=f"CHECK-OUT Recorded: {display_time} — Workout completed for {member['full_name']}."
        )

    else:
        # Scan 3: Already completed today
        in_time_str = format_time_field(existing['check_in_time'])
        out_time_str = format_time_field(existing['check_out_time'])
        return success_response(
            data={
                'attendance_id': existing['id'],
                'member_id': member['id'],
                'member_code': member['member_code'],
                'full_name': member['full_name'],
                'photo_url': member['photo_url'],
                'plan_name': member['plan_name'] or 'Standard Tier',
                'action': 'already_completed',
                'in_time': in_time_str,
                'out_time': out_time_str,
                'status': 'completed',
                'formatted_time': display_time
            },
            message=f"Member {member['full_name']} has already completed today's session (In: {in_time_str[:5]}, Out: {out_time_str[:5]})."
        )

@attendance_bp.route('/mark', methods=['POST'])
@token_required
@permission_required('attendance:checkin')
def mark_attendance():
    """Explicitly mark a member as present, absent, or late (Roll-call endpoint)."""
    data = request.get_json(silent=True) or {}
    member_id = data.get('member_id')
    member_code = data.get('member_code', '').strip().upper()
    status = data.get('status', 'present').strip().lower()
    date_val = data.get('date') or datetime.date.today().isoformat()
    check_in_time = data.get('check_in_time')
    check_out_time = data.get('check_out_time')
    notes = data.get('notes', '')

    if status not in ['present', 'absent', 'late']:
        return error_response("Invalid status. Must be 'present', 'absent', or 'late'.", status_code=400)

    # Resolve member
    if member_id:
        member = query_db("SELECT id, full_name, member_code FROM members WHERE id = %s", (member_id,), one=True)
    elif member_code:
        if member_code.startswith('APEX:MEMBER:'):
            member_code = member_code.replace('APEX:MEMBER:', '')
        member = query_db("SELECT id, full_name, member_code FROM members WHERE member_code = %s", (member_code,), one=True)
    else:
        return error_response("Member ID or Member Code is required", status_code=400)

    if not member:
        return error_response("Member not found", status_code=404)

    now_time = datetime.datetime.now().strftime('%H:%M:%S')
    if status == 'present' and not check_in_time:
        check_in_time = now_time
    elif status == 'absent':
        check_in_time = None
        check_out_time = None

    # Upsert attendance record for (member_id, date)
    existing = query_db("SELECT id FROM attendance WHERE member_id = %s AND date = %s", (member['id'], date_val), one=True)
    if existing:
        query_db("""
            UPDATE attendance 
            SET status = %s, check_in_time = %s, check_out_time = %s, notes = %s
            WHERE id = %s
        """, (status, check_in_time, check_out_time, notes, existing['id']), commit=True)
        rec_id = existing['id']
        msg = f"Attendance updated for {member['full_name']} on {date_val} (Status: {status.upper()})"
    else:
        res = query_db("""
            INSERT INTO attendance (member_id, date, check_in_time, check_out_time, status, notes)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (member['id'], date_val, check_in_time, check_out_time, status, notes), commit=True)
        rec_id = res['lastrowid']
        msg = f"Attendance recorded for {member['full_name']} on {date_val} (Status: {status.upper()})"

    return success_response(
        data={
            'attendance_id': rec_id,
            'member_id': member['id'],
            'member_name': member['full_name'],
            'member_code': member['member_code'],
            'date': date_val,
            'status': status,
            'check_in_time': check_in_time,
            'check_out_time': check_out_time,
            'notes': notes
        },
        message=msg
    )

@attendance_bp.route('/<int:attendance_id>', methods=['PUT'])
@token_required
@permission_required('attendance:edit')
def update_attendance_record(attendance_id):
    """Edit an attendance record (status, check-in, check-out, notes)."""
    record = query_db("SELECT * FROM attendance WHERE id = %s", (attendance_id,), one=True)
    if not record:
        return error_response("Attendance record not found", status_code=404)

    data = request.get_json(silent=True) or {}
    status = data.get('status', record['status']).strip().lower()
    if status not in ['present', 'absent', 'late']:
        return error_response("Invalid status. Must be 'present', 'absent', or 'late'.", status_code=400)

    check_in_time = data.get('check_in_time', record['check_in_time'])
    check_out_time = data.get('check_out_time', record['check_out_time'])
    notes = data.get('notes', record['notes'])

    if status == 'absent':
        check_in_time = None
        check_out_time = None

    query_db("""
        UPDATE attendance 
        SET status = %s, check_in_time = %s, check_out_time = %s, notes = %s
        WHERE id = %s
    """, (status, check_in_time, check_out_time, notes, attendance_id), commit=True)

    return success_response(
        data={
            'id': attendance_id,
            'status': status,
            'check_in_time': format_time_field(check_in_time),
            'check_out_time': format_time_field(check_out_time),
            'notes': notes
        },
        message="Attendance record updated successfully"
    )

@attendance_bp.route('/<int:attendance_id>', methods=['DELETE'])
@token_required
@permission_required('attendance:edit')
def delete_attendance_record(attendance_id):
    """Delete an attendance record."""
    record = query_db("SELECT id FROM attendance WHERE id = %s", (attendance_id,), one=True)
    if not record:
        return error_response("Attendance record not found", status_code=404)

    query_db("DELETE FROM attendance WHERE id = %s", (attendance_id,), commit=True)
    return success_response(message="Attendance record deleted successfully")

@attendance_bp.route('/check-out', methods=['POST'])
@token_required
@permission_required('attendance:checkout')
def check_out():
    """Record member checkout time."""
    data = request.get_json(silent=True) or {}
    attendance_id = data.get('attendance_id')
    member_id = data.get('member_id')
    today = datetime.date.today().isoformat()
    now_time = datetime.datetime.now().strftime('%H:%M:%S')

    if attendance_id:
        record = query_db("SELECT * FROM attendance WHERE id = %s", (attendance_id,), one=True)
    elif member_id:
        record = query_db("SELECT * FROM attendance WHERE member_id = %s AND date = %s", (member_id, today), one=True)
    else:
        return error_response('Attendance ID or Member ID is required', status_code=400)

    if not record:
        return error_response('Active check-in record not found for today', status_code=404)

    if record['check_out_time']:
        return error_response(f"Already checked out at {record['check_out_time']}", status_code=400)

    query_db("UPDATE attendance SET check_out_time = %s WHERE id = %s", (now_time, record['id']), commit=True)

    return success_response(
        data={'attendance_id': record['id'], 'check_out_time': now_time},
        message=f"Check-out recorded at {now_time}"
    )

@attendance_bp.route('/today', methods=['GET'])
@token_required
@permission_required('attendance:view')
def get_today_attendance():
    """Retrieve today's active attendance roster."""
    today = datetime.date.today().isoformat()
    rows = query_db("""
        SELECT a.id, a.member_id, a.date, a.check_in_time, a.check_out_time, a.status, a.notes,
               m.full_name, m.member_code, m.photo_url, m.phone,
               p.name as plan_name
        FROM attendance a
        JOIN members m ON a.member_id = m.id
        LEFT JOIN memberships ms ON m.id = ms.member_id AND ms.status = 'active'
        LEFT JOIN membership_plans p ON ms.plan_id = p.id
        WHERE a.date = %s
        ORDER BY CASE WHEN a.check_in_time IS NOT NULL THEN 0 ELSE 1 END, a.check_in_time DESC, a.id DESC
    """, (today,))

    records = []
    for r in rows:
        records.append({
            'id': r['id'],
            'member_id': r['member_id'],
            'date': str(r['date']),
            'check_in_time': format_time_field(r['check_in_time']),
            'check_out_time': format_time_field(r['check_out_time']),
            'status': r['status'],
            'notes': r['notes'],
            'full_name': r['full_name'],
            'member_code': r['member_code'],
            'photo_url': r['photo_url'],
            'phone': r['phone'],
            'plan_name': r['plan_name']
        })

    return success_response(data=records, message="Today's attendance list retrieved")

@attendance_bp.route('/members/badges', methods=['GET'])
@token_required
@permission_required('badges:view')
def get_member_badges():
    """Retrieve active members with QR payloads for printable ID passes."""
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

@attendance_bp.route('/history', methods=['GET'])
@token_required
@permission_required('attendance:view')
def get_attendance_history():
    """Retrieve attendance log with date filter, search, and pagination."""
    date_from = request.args.get('from')
    date_to = request.args.get('to')
    search = request.args.get('search', '').strip()
    page = int(request.args.get('page', 1))
    limit = int(request.args.get('limit', 15))
    offset = (page - 1) * limit

    where = ["1=1"]
    params = []

    if date_from:
        where.append("a.date >= %s")
        params.append(date_from)
    if date_to:
        where.append("a.date <= %s")
        params.append(date_to)
    if search:
        where.append("(m.full_name LIKE %s OR m.member_code LIKE %s)")
        params.extend([f"%{search}%", f"%{search}%"])

    where_sql = " AND ".join(where)

    total_row = query_db(f"""
        SELECT COUNT(*) as total 
        FROM attendance a 
        JOIN members m ON a.member_id = m.id 
        WHERE {where_sql}
    """, tuple(params), one=True)
    total = total_row['total'] if total_row else 0

    query_sql = f"""
        SELECT a.id, a.member_id, a.date, a.check_in_time, a.check_out_time, a.status, a.notes,
               m.full_name, m.member_code, m.photo_url
        FROM attendance a
        JOIN members m ON a.member_id = m.id
        WHERE {where_sql}
        ORDER BY a.date DESC, a.check_in_time DESC
        LIMIT %s OFFSET %s
    """
    params.extend([limit, offset])
    records = query_db(query_sql, tuple(params))

    return success_response(
        data=records,
        pagination={'page': page, 'limit': limit, 'total': total, 'pages': (total + limit - 1) // limit if total > 0 else 1},
        message='Attendance history retrieved'
    )

@attendance_bp.route('/member/<int:member_id>', methods=['GET'])
@token_required
def get_member_attendance(member_id):
    """Retrieve personal attendance logs for a member."""
    # Check access permission
    if request.current_user['role'] == 'member':
        member_rec = query_db("SELECT id FROM members WHERE user_id = %s", (request.current_user['id'],), one=True)
        if not member_rec or member_rec['id'] != member_id:
            return error_response('Access forbidden', status_code=403)

    records = query_db("""
        SELECT id, date, check_in_time, check_out_time, status, notes
        FROM attendance
        WHERE member_id = %s
        ORDER BY date DESC
        LIMIT 30
    """, (member_id,))

    # Calculate attendance streak and stats
    total_checkins = query_db("SELECT COUNT(*) as count FROM attendance WHERE member_id = %s", (member_id,), one=True)['count']

    return success_response(
        data={'records': records, 'total_checkins': total_checkins},
        message='Member attendance retrieved'
    )

# ==============================================================================
# TRAINER QR ATTENDANCE DESK (IN-TIME & OUT-TIME)
# ==============================================================================

@attendance_bp.route('/trainers/scan', methods=['POST'])
@token_required
@permission_required('trainer_attendance:manage')
def scan_trainer_qr():
    """
    Process trainer QR code scan for In-Time & Out-Time attendance.
    Intelligently determines whether to clock in (Scan 1) or clock out (Scan 2).
    """
    data = request.get_json(silent=True) or {}
    raw_code = data.get('qr_code') or data.get('trainer_code') or ''
    trainer_id = data.get('trainer_id')
    notes = data.get('notes', '')

    raw_code = str(raw_code).strip()

    # Parse QR payload prefix if present (e.g. "APEX:TRAINER:TRN-001" or "APEX:TRAINER:1")
    search_code = raw_code
    if search_code.startswith('APEX:TRAINER:'):
        search_code = search_code.replace('APEX:TRAINER:', '').strip()

    trainer = None
    if trainer_id:
        trainer = query_db("SELECT id, trainer_code, full_name, email, phone, specialization, photo_url, schedule FROM trainers WHERE id = %s", (trainer_id,), one=True)
    elif search_code:
        # Try matching trainer_code, id, or email
        trainer = query_db("""
            SELECT id, trainer_code, full_name, email, phone, specialization, photo_url, schedule 
            FROM trainers 
            WHERE trainer_code = %s OR id = %s OR email = %s
        """, (search_code, search_code if search_code.isdigit() else -1, search_code), one=True)

    if not trainer:
        return error_response(f"Trainer badge not recognized: '{raw_code}'", status_code=404)

    today = datetime.date.today().isoformat()
    now_dt = datetime.datetime.now()
    now_time = now_dt.strftime('%H:%M:%S')
    display_time = now_dt.strftime('%I:%M %p')

    # Check today's attendance record for this trainer
    existing = query_db(
        "SELECT id, date, in_time, out_time, total_hours, status, notes FROM trainer_attendance WHERE trainer_id = %s AND date = %s",
        (trainer['id'], today),
        one=True
    )

    if not existing:
        # CASE 1: First Scan -> Clock-In (IN-TIME)
        res = query_db("""
            INSERT INTO trainer_attendance (trainer_id, date, in_time, status, notes)
            VALUES (%s, %s, %s, 'present', %s)
        """, (trainer['id'], today, now_time, notes or 'QR Check-in'), commit=True)

        trainer_dict = {
            'id': trainer['id'],
            'trainer_code': trainer['trainer_code'],
            'full_name': trainer['full_name'],
            'specialization': trainer['specialization'],
            'photo_url': trainer['photo_url']
        }

        return success_response(
            data={
                'attendance_id': res['lastrowid'],
                'trainer_id': trainer['id'],
                'trainer_code': trainer['trainer_code'],
                'full_name': trainer['full_name'],
                'specialization': trainer['specialization'],
                'photo_url': trainer['photo_url'],
                'trainer': trainer_dict,
                'in_time': now_time,
                'out_time': None,
                'total_hours': None,
                'status': 'present',
                'action': 'check_in',
                'formatted_time': display_time
            },
            message=f"IN-TIME Recorded: {display_time} — Master Coach {trainer['full_name']} marked PRESENT."
        )

    elif existing['out_time'] is None:
        # CASE 2: Second Scan -> Clock-Out (OUT-TIME) & Calculate Duration
        in_time_str = format_time_field(existing['in_time'])
        in_hour, in_min, in_sec = map(int, in_time_str.split(':'))
        in_dt = now_dt.replace(hour=in_hour, minute=in_min, second=in_sec, microsecond=0)
        
        diff_seconds = max((now_dt - in_dt).total_seconds(), 0)
        total_hours = round(max(diff_seconds / 3600.0, 0.05), 2)

        query_db("""
            UPDATE trainer_attendance 
            SET out_time = %s, total_hours = %s, status = 'completed'
            WHERE id = %s
        """, (now_time, total_hours, existing['id']), commit=True)

        trainer_dict = {
            'id': trainer['id'],
            'trainer_code': trainer['trainer_code'],
            'full_name': trainer['full_name'],
            'specialization': trainer['specialization'],
            'photo_url': trainer['photo_url']
        }

        return success_response(
            data={
                'attendance_id': existing['id'],
                'trainer_id': trainer['id'],
                'trainer_code': trainer['trainer_code'],
                'full_name': trainer['full_name'],
                'specialization': trainer['specialization'],
                'photo_url': trainer['photo_url'],
                'trainer': trainer_dict,
                'in_time': in_time_str,
                'out_time': now_time,
                'total_hours': total_hours,
                'status': 'completed',
                'action': 'check_out',
                'formatted_time': display_time
            },
            message=f"OUT-TIME Recorded: {display_time} — Shift COMPLETED for {trainer['full_name']} (Duration: {total_hours} hrs)."
        )

    else:
        # CASE 3: Already checked out today
        in_time_str = format_time_field(existing['in_time'])
        out_time_str = format_time_field(existing['out_time'])
        hours = float(existing['total_hours']) if existing['total_hours'] else 0.0

        trainer_dict = {
            'id': trainer['id'],
            'trainer_code': trainer['trainer_code'],
            'full_name': trainer['full_name'],
            'specialization': trainer['specialization'],
            'photo_url': trainer['photo_url']
        }

        return success_response(
            data={
                'attendance_id': existing['id'],
                'trainer_id': trainer['id'],
                'trainer_code': trainer['trainer_code'],
                'full_name': trainer['full_name'],
                'specialization': trainer['specialization'],
                'photo_url': trainer['photo_url'],
                'trainer': trainer_dict,
                'in_time': in_time_str,
                'out_time': out_time_str,
                'total_hours': hours,
                'status': 'completed',
                'action': 'already_completed',
                'formatted_time': display_time
            },
            message=f"Trainer {trainer['full_name']} has ALREADY completed today's shift (In: {in_time_str[:5]}, Out: {out_time_str[:5]} — {hours} hrs)."
        )

@attendance_bp.route('/trainers/today', methods=['GET'])
@token_required
@permission_required('trainer_attendance:manage')
def get_today_trainer_attendance():
    """Retrieve today's active trainer shift roster."""
    today = datetime.date.today().isoformat()
    rows = query_db("""
        SELECT t.id as trainer_id, t.trainer_code, t.full_name, t.specialization, t.photo_url, t.schedule,
               ta.id as attendance_id, ta.date, ta.in_time, ta.out_time, ta.total_hours, ta.status as attendance_status, ta.notes
        FROM trainers t
        LEFT JOIN trainer_attendance ta ON t.id = ta.trainer_id AND ta.date = %s
        WHERE t.status = 'active'
        ORDER BY ta.in_time DESC, t.id ASC
    """, (today,))

    result = []
    active_shifts = 0
    completed_shifts = 0

    for r in rows:
        in_time = format_time_field(r['in_time'])
        out_time = format_time_field(r['out_time'])
        total_hours = float(r['total_hours']) if r['total_hours'] else None
        
        status = 'not_present'
        if in_time and not out_time:
            status = 'on_shift'
            active_shifts += 1
        elif in_time and out_time:
            status = 'completed'
            completed_shifts += 1

        result.append({
            'trainer_id': r['trainer_id'],
            'trainer_code': r['trainer_code'],
            'full_name': r['full_name'],
            'specialization': r['specialization'],
            'photo_url': r['photo_url'],
            'schedule': r['schedule'],
            'attendance_id': r['attendance_id'],
            'in_time': in_time,
            'out_time': out_time,
            'total_hours': total_hours,
            'status': status,
            'notes': r['notes']
        })

    stats_dict = {
        'total_trainers': len(result),
        'active_shifts': active_shifts,
        'completed_shifts': completed_shifts,
        'not_present': len(result) - active_shifts - completed_shifts
    }

    return success_response(
        data={
            'trainers': result,
            'roster': result,
            'stats': stats_dict,
            'summary': stats_dict
        },
        message="Today's trainer roster retrieved"
    )

@attendance_bp.route('/trainers/history', methods=['GET'])
@token_required
@permission_required('trainer_attendance:manage')
def get_trainer_attendance_history():
    """Retrieve historical trainer attendance log."""
    trainer_id = request.args.get('trainer_id')
    date_from = request.args.get('from')
    date_to = request.args.get('to')
    page = int(request.args.get('page', 1))
    limit = int(request.args.get('limit', 15))
    offset = (page - 1) * limit

    where = ["1=1"]
    params = []

    if trainer_id:
        where.append("ta.trainer_id = %s")
        params.append(trainer_id)
    if date_from:
        where.append("ta.date >= %s")
        params.append(date_from)
    if date_to:
        where.append("ta.date <= %s")
        params.append(date_to)

    where_sql = " AND ".join(where)

    total_row = query_db(f"""
        SELECT COUNT(*) as total 
        FROM trainer_attendance ta 
        JOIN trainers t ON ta.trainer_id = t.id
        WHERE {where_sql}
    """, tuple(params), one=True)
    total = total_row['total'] if total_row else 0

    rows = query_db(f"""
        SELECT ta.id, ta.trainer_id, ta.date, ta.in_time, ta.out_time, ta.total_hours, ta.status, ta.notes,
               t.trainer_code, t.full_name, t.specialization, t.photo_url
        FROM trainer_attendance ta
        JOIN trainers t ON ta.trainer_id = t.id
        WHERE {where_sql}
        ORDER BY ta.date DESC, ta.in_time DESC
        LIMIT %s OFFSET %s
    """, tuple(params + [limit, offset]))

    records = []
    for r in rows:
        records.append({
            'id': r['id'],
            'trainer_id': r['trainer_id'],
            'trainer_code': r['trainer_code'],
            'full_name': r['full_name'],
            'specialization': r['specialization'],
            'photo_url': r['photo_url'],
            'date': str(r['date']),
            'in_time': format_time_field(r['in_time']),
            'out_time': format_time_field(r['out_time']),
            'total_hours': float(r['total_hours']) if r['total_hours'] else None,
            'status': r['status'],
            'notes': r['notes']
        })

    return success_response(
        data=records,
        pagination={'page': page, 'limit': limit, 'total': total, 'pages': (total + limit - 1) // limit if total > 0 else 1},
        message="Trainer attendance history retrieved"
    )

@attendance_bp.route('/trainers/badges', methods=['GET'])
@token_required
@permission_required('badges:view')
def get_trainer_badges():
    """Return all active trainers with their QR code payloads for badge printing."""
    trainers = query_db("""
        SELECT id, trainer_code, full_name, email, phone, specialization, experience_years, bio, schedule, photo_url
        FROM trainers
        WHERE status = 'active'
        ORDER BY id ASC
    """)

    for t in trainers:
        t['qr_payload'] = f"APEX:TRAINER:{t['trainer_code']}"

    return success_response(data=trainers, message="Trainer badges retrieved")

