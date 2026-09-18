from flask import Blueprint, request
from backend.database import query_db
from backend.utils.auth_middleware import token_required
from backend.utils.helpers import success_response, error_response

notification_bp = Blueprint('notifications', __name__, url_prefix='/api/notifications')

@notification_bp.route('', methods=['GET'])
@token_required
def list_notifications():
    """Retrieve notifications for the current authenticated user."""
    user_id = request.current_user['id']
    notifications = query_db("""
        SELECT * FROM notifications 
        WHERE user_id = %s 
        ORDER BY created_at DESC 
        LIMIT 20
    """, (user_id,))

    unread_count = sum(1 for n in notifications if not n['is_read'])

    return success_response(
        data={'notifications': notifications, 'unread_count': unread_count},
        message='Notifications retrieved'
    )

@notification_bp.route('/<int:notif_id>/read', methods=['PUT'])
@token_required
def mark_as_read(notif_id):
    """Mark single notification as read."""
    user_id = request.current_user['id']
    query_db("UPDATE notifications SET is_read = TRUE WHERE id = %s AND user_id = %s", (notif_id, user_id), commit=True)
    return success_response(message='Notification marked as read')

@notification_bp.route('/read-all', methods=['PUT'])
@token_required
def mark_all_read():
    """Mark all notifications as read for current user."""
    user_id = request.current_user['id']
    query_db("UPDATE notifications SET is_read = TRUE WHERE user_id = %s", (user_id,), commit=True)
    return success_response(message='All notifications marked as read')
