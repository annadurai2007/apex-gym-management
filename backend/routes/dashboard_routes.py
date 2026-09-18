import datetime
from flask import Blueprint, request
from backend.database import query_db
from backend.utils.auth_middleware import token_required, role_required
from backend.utils.helpers import success_response, error_response

dashboard_bp = Blueprint('dashboard', __name__, url_prefix='/api/dashboard')

@dashboard_bp.route('/stats', methods=['GET'])
@token_required
@role_required(['admin', 'staff', 'trainer'])
def get_stats():
    """Retrieve comprehensive gym metrics calculated directly from database."""
    today = datetime.date.today().isoformat()
    now = datetime.datetime.now()
    first_day_of_month = datetime.date(now.year, now.month, 1).isoformat()

    # 1. Member stats
    member_counts = query_db("""
        SELECT 
            COUNT(*) as total_members,
            SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_members,
            SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired_members,
            SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_members,
            SUM(CASE WHEN joining_date >= %s THEN 1 ELSE 0 END) as new_this_month
        FROM members
    """, (first_day_of_month,), one=True)

    # 2. Today's attendance
    today_attendance = query_db("""
        SELECT 
            COUNT(*) as checkin_count,
            SUM(CASE WHEN check_out_time IS NULL THEN 1 ELSE 0 END) as currently_in_gym
        FROM attendance
        WHERE date = %s
    """, (today,), one=True)

    # 3. Financial stats (This month's revenue)
    financials = query_db("""
        SELECT 
            COALESCE(SUM(CASE WHEN status = 'paid' AND payment_date >= %s THEN amount ELSE 0 END), 0) as monthly_revenue,
            COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) as pending_amount,
            COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
            COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) as total_lifetime_revenue
        FROM payments
    """, (first_day_of_month,), one=True)

    # 4. Trainer count
    trainer_count = query_db("SELECT COUNT(*) as count FROM trainers WHERE status = 'active'", one=True)

    today_dt = datetime.date.today()
    today = today_dt.isoformat()
    end_7 = (today_dt + datetime.timedelta(days=7)).isoformat()

    # 5. Expiring soon count (Memberships ending within 7 days from today)
    expiring_soon = query_db("""
        SELECT COUNT(*) as count
        FROM memberships
        WHERE status = 'active'
          AND end_date BETWEEN %s AND %s
    """, (today, end_7), one=True)

    data = {
        'total_members': member_counts['total_members'] or 0,
        'active_members': member_counts['active_members'] or 0,
        'expired_members': member_counts['expired_members'] or 0,
        'pending_members': member_counts['pending_members'] or 0,
        'new_this_month': member_counts['new_this_month'] or 0,
        'today_attendance': today_attendance['checkin_count'] or 0,
        'currently_in_gym': today_attendance['currently_in_gym'] or 0,
        'monthly_revenue': financials['monthly_revenue'] or 0.0,
        'total_lifetime_revenue': financials['total_lifetime_revenue'] or 0.0,
        'pending_payments_count': financials['pending_count'] or 0,
        'pending_payments_amount': financials['pending_amount'] or 0.0,
        'active_trainers': trainer_count['count'] or 0,
        'expiring_soon_count': expiring_soon['count'] or 0
    }

    return success_response(data=data, message='Dashboard statistics retrieved')

@dashboard_bp.route('/charts', methods=['GET'])
@token_required
@role_required(['admin', 'staff', 'trainer'])
def get_charts():
    """Retrieve time-series and categorical data for Chart.js dashboard charts."""
    # 1. Monthly Revenue for past 6 months
    monthly_rev = query_db("""
        SELECT 
            DATE_FORMAT(payment_date, '%Y-%m') as month_key,
            DATE_FORMAT(payment_date, '%b %Y') as label,
            COALESCE(SUM(amount), 0) as total
        FROM payments
        WHERE status = 'paid'
        GROUP BY month_key, label
        ORDER BY month_key ASC
        LIMIT 6
    """)

    # 2. Attendance trends over past 7 days
    attendance_trend = query_db("""
        SELECT 
            date,
            DATE_FORMAT(date, '%a (%d %b)') as label,
            COUNT(*) as count
        FROM attendance
        GROUP BY date, label
        ORDER BY date DESC
        LIMIT 7
    """)
    # Reverse so it flows chronologically left to right
    attendance_trend = list(reversed(attendance_trend))

    # 3. Membership Distribution by Plan
    plan_distribution = query_db("""
        SELECT 
            p.name as plan_name,
            COUNT(m.id) as active_count
        FROM membership_plans p
        LEFT JOIN memberships m ON p.id = m.plan_id AND m.status = 'active'
        GROUP BY p.id, p.name
        ORDER BY active_count DESC
    """)

    data = {
        'revenue_chart': {
            'labels': [row['label'] for row in monthly_rev],
            'data': [float(row['total']) for row in monthly_rev]
        },
        'attendance_chart': {
            'labels': [row['label'] for row in attendance_trend],
            'data': [row['count'] for row in attendance_trend]
        },
        'plan_chart': {
            'labels': [row['plan_name'] for row in plan_distribution],
            'data': [row['active_count'] for row in plan_distribution]
        }
    }

    return success_response(data=data, message='Chart metrics retrieved')

@dashboard_bp.route('/recent-activity', methods=['GET'])
@token_required
@role_required(['admin', 'staff', 'trainer'])
def get_recent_activity():
    """Get recent member registrations, payments, and expiring memberships."""
    today = datetime.date.today().isoformat()

    recent_members = query_db("""
        SELECT id, member_code, full_name, email, photo_url, joining_date, status
        FROM members
        ORDER BY id DESC
        LIMIT 5
    """)

    recent_payments = query_db("""
        SELECT p.id, p.invoice_no, p.amount, p.payment_date, p.payment_method, p.status,
               m.full_name as member_name, m.member_code
        FROM payments p
        JOIN members m ON p.member_id = m.id
        ORDER BY p.id DESC
        LIMIT 5
    """)

    end_14 = (datetime.date.today() + datetime.timedelta(days=14)).isoformat()
    expiring_soon = query_db("""
        SELECT ms.id as membership_id, ms.end_date, ms.price_paid,
               m.id as member_id, m.full_name, m.email, m.phone, m.member_code,
               p.name as plan_name,
               DATEDIFF(ms.end_date, %s) as days_remaining
        FROM memberships ms
        JOIN members m ON ms.member_id = m.id
        JOIN membership_plans p ON ms.plan_id = p.id
        WHERE ms.status = 'active'
          AND ms.end_date BETWEEN %s AND %s
        ORDER BY ms.end_date ASC
        LIMIT 5
    """, (today, today, end_14))

    data = {
        'recent_members': recent_members,
        'recent_payments': recent_payments,
        'expiring_soon': expiring_soon
    }

    return success_response(data=data, message='Recent activity retrieved')
