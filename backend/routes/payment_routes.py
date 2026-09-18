import datetime
from flask import Blueprint, request
from backend.database import query_db
from backend.utils.auth_middleware import token_required, role_required
from backend.utils.helpers import success_response, error_response, generate_invoice_no

payment_bp = Blueprint('payments', __name__, url_prefix='/api/payments')

@payment_bp.route('', methods=['GET'])
@token_required
def list_payments():
    """List payments with filters, search, and pagination."""
    user = request.current_user
    page = int(request.args.get('page', 1))
    limit = int(request.args.get('limit', 15))
    offset = (page - 1) * limit
    status = request.args.get('status', '').strip()
    method = request.args.get('method', '').strip()
    search = request.args.get('search', '').strip()
    date_from = request.args.get('from')
    date_to = request.args.get('to')

    where = ["1=1"]
    params = []

    # Member restriction: members only see their own payments
    if user['role'] == 'member':
        member_rec = query_db("SELECT id FROM members WHERE user_id = %s", (user['id'],), one=True)
        if not member_rec:
            return success_response(data=[], pagination={'page': 1, 'limit': limit, 'total': 0, 'pages': 1})
        where.append("p.member_id = %s")
        params.append(member_rec['id'])

    if status and status != 'all':
        where.append("p.status = %s")
        params.append(status)

    if method and method != 'all':
        where.append("p.payment_method = %s")
        params.append(method)

    if date_from:
        where.append("p.payment_date >= %s")
        params.append(date_from)

    if date_to:
        where.append("p.payment_date <= %s")
        params.append(date_to)

    if search:
        where.append("(m.full_name LIKE %s OR m.member_code LIKE %s OR p.invoice_no LIKE %s)")
        params.extend([f"%{search}%", f"%{search}%", f"%{search}%"])

    where_sql = " AND ".join(where)

    total_row = query_db(f"""
        SELECT COUNT(*) as total 
        FROM payments p
        JOIN members m ON p.member_id = m.id
        WHERE {where_sql}
    """, tuple(params), one=True)
    total = total_row['total'] if total_row else 0

    query_sql = f"""
        SELECT p.*, m.full_name as member_name, m.member_code, m.email as member_email,
               pl.name as plan_name
        FROM payments p
        JOIN members m ON p.member_id = m.id
        LEFT JOIN memberships ms ON p.membership_id = ms.id
        LEFT JOIN membership_plans pl ON ms.plan_id = pl.id
        WHERE {where_sql}
        ORDER BY p.payment_date DESC, p.id DESC
        LIMIT %s OFFSET %s
    """
    params.extend([limit, offset])
    payments = query_db(query_sql, tuple(params))

    return success_response(
        data=payments,
        pagination={'page': page, 'limit': limit, 'total': total, 'pages': (total + limit - 1) // limit if total > 0 else 1},
        message='Payments retrieved'
    )

@payment_bp.route('/<int:payment_id>/receipt', methods=['GET'])
@token_required
def get_receipt(payment_id):
    """Retrieve detailed printable receipt information for a transaction."""
    payment = query_db("""
        SELECT p.*, 
               m.full_name as member_name, m.member_code, m.email as member_email, m.phone as member_phone, m.address as member_address,
               ms.start_date, ms.end_date,
               pl.name as plan_name, pl.duration_months
        FROM payments p
        JOIN members m ON p.member_id = m.id
        LEFT JOIN memberships ms ON p.membership_id = ms.id
        LEFT JOIN membership_plans pl ON ms.plan_id = pl.id
        WHERE p.id = %s
    """, (payment_id,), one=True)

    if not payment:
        return error_response('Payment receipt not found', status_code=404)

    # If member, ensure it's their own payment
    if request.current_user['role'] == 'member':
        member_rec = query_db("SELECT id FROM members WHERE user_id = %s", (request.current_user['id'],), one=True)
        if not member_rec or member_rec['id'] != payment['member_id']:
            return error_response('Access forbidden', status_code=403)

    receipt = {
        'gym_info': {
            'name': 'APEX FITNESS CLUB',
            'tagline': 'BUILD YOUR STRONGER SELF',
            'address': 'Level 4, Apex Tower, 100 Olympic Boulevard',
            'email': 'billing@apexgym.com',
            'phone': '+1 (800) 555-APEX',
            'tax_id': 'US-TAX-889410-X'
        },
        'payment': payment
    }

    return success_response(data=receipt, message='Receipt retrieved')

@payment_bp.route('', methods=['POST'])
@token_required
@role_required(['admin', 'staff', 'trainer'])
def record_payment():
    """Record manual payment or offline dues settlement."""
    data = request.get_json(silent=True) or {}
    member_id = data.get('member_id')
    amount = data.get('amount')
    payment_method = data.get('payment_method', 'cash')
    payment_date = data.get('payment_date') or datetime.date.today().isoformat()
    status = data.get('status', 'paid')
    notes = data.get('notes', 'Manual payment entry')
    membership_id = data.get('membership_id')

    if not member_id or not amount:
        return error_response('Member ID and Amount are required', status_code=400)

    member = query_db("SELECT id, member_code, full_name, user_id FROM members WHERE id = %s", (member_id,), one=True)
    if not member:
        return error_response('Member not found', status_code=404)

    invoice_no = generate_invoice_no()
    tx_id = f"TXN_{member['member_code']}_{invoice_no[-4:]}"

    res = query_db("""
        INSERT INTO payments (member_id, membership_id, invoice_no, amount, payment_date, payment_method, transaction_id, status, notes)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
    """, (member_id, membership_id, invoice_no, float(amount), payment_date, payment_method, tx_id, status, notes), commit=True)

    if member['user_id']:
        query_db("""
            INSERT INTO notifications (user_id, title, message, type)
            VALUES (%s, 'Payment Acknowledged', %s, 'success')
        """, (member['user_id'], f"Receipt {invoice_no} for ${float(amount):.2f} has been processed successfully."), commit=True)

    return success_response(
        data={'payment_id': res['lastrowid'], 'invoice_no': invoice_no},
        message=f'Payment of ${float(amount):.2f} recorded successfully for {member["full_name"]}',
        status_code=201
    )

@payment_bp.route('/pending', methods=['GET'])
@token_required
@role_required(['admin', 'staff', 'trainer'])
def get_pending_dues():
    """Retrieve members with pending payments or expired memberships needing renewal."""
    today = datetime.date.today().isoformat()
    pending = query_db("""
        SELECT 
            m.id as member_id, m.member_code, m.full_name, m.email, m.phone, m.status as member_status,
            ms.id as membership_id, ms.end_date,
            p.name as plan_name, p.price as renewal_price
        FROM members m
        JOIN memberships ms ON m.id = ms.member_id
        JOIN membership_plans p ON ms.plan_id = p.id
        WHERE m.status = 'expired' OR ms.status = 'expired' OR ms.end_date < %s
        ORDER BY ms.end_date ASC
    """, (today,))

    return success_response(data=pending, message='Pending dues retrieved')
