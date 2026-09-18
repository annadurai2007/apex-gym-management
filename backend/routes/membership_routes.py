import datetime
from flask import Blueprint, request
from backend.database import query_db
from backend.utils.auth_middleware import token_required, role_required
from backend.utils.helpers import success_response, error_response, generate_invoice_no

membership_bp = Blueprint('memberships', __name__, url_prefix='/api/memberships')

@membership_bp.route('/assign', methods=['POST'])
@token_required
@role_required(['admin', 'staff', 'trainer'])
def assign_or_renew_membership():
    """Assign or renew a membership plan for a member."""
    data = request.get_json(silent=True) or {}
    member_id = data.get('member_id')
    plan_id = data.get('plan_id')
    payment_method = data.get('payment_method', 'card')
    amount_paid = data.get('amount_paid')
    start_date_str = data.get('start_date')
    auto_renew = bool(data.get('auto_renew', False))

    if not member_id or not plan_id:
        return error_response('Member ID and Plan ID are required', status_code=400)

    member = query_db("SELECT * FROM members WHERE id = %s", (member_id,), one=True)
    if not member:
        return error_response('Member not found', status_code=404)

    plan = query_db("SELECT * FROM membership_plans WHERE id = %s", (plan_id,), one=True)
    if not plan:
        return error_response('Plan not found', status_code=404)

    # Determine start date (default today, or after current active plan ends)
    today = datetime.date.today()
    if start_date_str:
        start_date = datetime.datetime.strptime(start_date_str, '%Y-%m-%d').date()
    else:
        # Check if there is an active membership ending in the future
        active_ms = query_db("""
            SELECT end_date FROM memberships 
            WHERE member_id = %s AND status = 'active' AND end_date >= %s
            ORDER BY end_date DESC LIMIT 1
        """, (member_id, today), one=True)
        if active_ms:
            start_date = active_ms['end_date'] + datetime.timedelta(days=1)
        else:
            start_date = today

    duration_months = int(plan['duration_months'])
    end_date = start_date + datetime.timedelta(days=30 * duration_months)

    price = float(amount_paid) if amount_paid is not None else float(plan['price'])

    # Expire previous memberships if start_date <= today
    if start_date <= today:
        query_db("UPDATE memberships SET status = 'renewed' WHERE member_id = %s AND status = 'active'", (member_id,), commit=True)
        ms_status = 'active'
    else:
        ms_status = 'active'

    ms_res = query_db("""
        INSERT INTO memberships (member_id, plan_id, start_date, end_date, price_paid, status, auto_renew)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
    """, (member_id, plan_id, start_date, end_date, price, ms_status, auto_renew), commit=True)

    membership_id = ms_res['lastrowid']

    # Update member status to active
    query_db("UPDATE members SET status = 'active' WHERE id = %s", (member_id,), commit=True)

    # Record payment
    invoice_no = generate_invoice_no()
    query_db("""
        INSERT INTO payments (member_id, membership_id, invoice_no, amount, payment_date, payment_method, transaction_id, status, notes)
        VALUES (%s, %s, %s, %s, %s, %s, %s, 'paid', %s)
    """, (member_id, membership_id, invoice_no, price, today, payment_method, f"TXN_{member['member_code']}_{invoice_no[-4:]}", f"Subscription renewal: {plan['name']}"), commit=True)

    # Send notification to member
    if member['user_id']:
        query_db("""
            INSERT INTO notifications (user_id, title, message, type)
            VALUES (%s, 'Membership Renewed', %s, 'success')
        """, (member['user_id'], f"Your {plan['name']} plan has been activated through {end_date.strftime('%B %d, %Y')}."), commit=True)

    return success_response(
        data={'membership_id': membership_id, 'invoice_no': invoice_no, 'end_date': end_date.isoformat()},
        message=f"Plan {plan['name']} assigned to {member['full_name']} successfully"
    )

@membership_bp.route('/expiring', methods=['GET'])
@token_required
@role_required(['admin', 'staff'])
def get_expiring_memberships():
    """Retrieve all memberships expiring within N days (default 14 days)."""
    days = int(request.args.get('days', 14))
    today_dt = datetime.date.today()
    today = today_dt.isoformat()
    end_target = (today_dt + datetime.timedelta(days=days)).isoformat()

    expiring = query_db("""
        SELECT ms.id as membership_id, ms.start_date, ms.end_date, ms.price_paid,
               m.id as member_id, m.member_code, m.full_name, m.email, m.phone, m.photo_url,
               p.name as plan_name,
               DATEDIFF(ms.end_date, %s) as days_remaining
        FROM memberships ms
        JOIN members m ON ms.member_id = m.id
        JOIN membership_plans p ON ms.plan_id = p.id
        WHERE ms.status = 'active'
          AND ms.end_date BETWEEN %s AND %s
        ORDER BY ms.end_date ASC
    """, (today, today, end_target))

    return success_response(data=expiring, message='Expiring memberships retrieved')
