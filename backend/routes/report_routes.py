import io
import csv
from flask import Blueprint, request, make_response
from backend.database import query_db
from backend.utils.auth_middleware import token_required, role_required
from backend.utils.helpers import success_response

report_bp = Blueprint('reports', __name__, url_prefix='/api/reports')

@report_bp.route('/summary', methods=['GET'])
@token_required
@role_required(['admin', 'staff', 'trainer'])
def get_reports_summary():
    """Retrieve aggregate performance summary."""
    revenue_by_method = query_db("""
        SELECT payment_method, COUNT(*) as count, SUM(amount) as total
        FROM payments
        WHERE status = 'paid'
        GROUP BY payment_method
    """)

    top_plans = query_db("""
        SELECT p.name, COUNT(ms.id) as subscriber_count, SUM(ms.price_paid) as total_revenue
        FROM membership_plans p
        LEFT JOIN memberships ms ON p.id = ms.plan_id
        GROUP BY p.id, p.name
        ORDER BY total_revenue DESC
    """)

    trainer_performance = query_db("""
        SELECT t.id, t.full_name, t.specialization, COUNT(ta.id) as client_count
        FROM trainers t
        LEFT JOIN trainer_assignments ta ON t.id = ta.trainer_id AND ta.status = 'active'
        GROUP BY t.id
        ORDER BY client_count DESC
    """)

    attendance_by_day = query_db("""
        SELECT DAYNAME(date) as day_name, COUNT(*) as count
        FROM attendance
        GROUP BY day_name
        ORDER BY FIELD(day_name, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')
    """)

    return success_response(
        data={
            'revenue_by_method': revenue_by_method,
            'top_plans': top_plans,
            'trainer_performance': trainer_performance,
            'attendance_by_day': attendance_by_day
        },
        message='Reports summary retrieved'
    )

@report_bp.route('/export/payments', methods=['GET'])
@token_required
@role_required(['admin', 'staff', 'trainer'])
def export_payments_csv():
    """Export payments database to downloadable CSV."""
    payments = query_db("""
        SELECT p.invoice_no, m.member_code, m.full_name, p.amount, p.payment_date,
               p.payment_method, p.transaction_id, p.status, p.notes
        FROM payments p
        JOIN members m ON p.member_id = m.id
        ORDER BY p.payment_date DESC
    """)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['Invoice No', 'Member Code', 'Member Name', 'Amount ($)', 'Date', 'Method', 'Transaction ID', 'Status', 'Notes'])

    for p in payments:
        writer.writerow([
            p['invoice_no'], p['member_code'], p['full_name'], f"{float(p['amount']):.2f}",
            p['payment_date'], p['payment_method'], p['transaction_id'], p['status'], p['notes']
        ])

    response = make_response(output.getvalue())
    response.headers['Content-Disposition'] = 'attachment; filename=apex_payments_report.csv'
    response.headers['Content-type'] = 'text/csv'
    return response

@report_bp.route('/export/attendance', methods=['GET'])
@token_required
@role_required(['admin', 'staff', 'trainer'])
def export_attendance_csv():
    """Export attendance database to downloadable CSV."""
    records = query_db("""
        SELECT a.date, m.member_code, m.full_name, a.check_in_time, a.check_out_time, a.status, a.notes
        FROM attendance a
        JOIN members m ON a.member_id = m.id
        ORDER BY a.date DESC, a.check_in_time DESC
    """)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['Date', 'Member Code', 'Member Name', 'Check-In Time', 'Check-Out Time', 'Status', 'Notes'])

    for r in records:
        writer.writerow([
            r['date'], r['member_code'], r['full_name'], r['check_in_time'],
            r['check_out_time'] or 'Not checked out', r['status'], r['notes'] or ''
        ])

    response = make_response(output.getvalue())
    response.headers['Content-Disposition'] = 'attachment; filename=apex_attendance_report.csv'
    response.headers['Content-type'] = 'text/csv'
    return response
