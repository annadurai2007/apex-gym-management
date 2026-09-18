import os
from flask import Flask, send_from_directory, jsonify
from flask_cors import CORS
from backend.config import Config

# Import blueprints
from backend.routes.auth_routes import auth_bp
from backend.routes.dashboard_routes import dashboard_bp
from backend.routes.member_routes import member_bp
from backend.routes.trainer_routes import trainer_bp
from backend.routes.plan_routes import plan_bp
from backend.routes.membership_routes import membership_bp
from backend.routes.attendance_routes import attendance_bp
from backend.routes.payment_routes import payment_bp
from backend.routes.workout_routes import workout_bp
from backend.routes.diet_routes import diet_bp
from backend.routes.report_routes import report_bp
from backend.routes.notification_routes import notification_bp

def create_app():
    """Application factory for Apex Gym Management System."""
    app = Flask(__name__, static_folder=None)
    app.config.from_object(Config)

    # Enable CORS
    CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)

    # Register API Blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(member_bp)
    app.register_blueprint(trainer_bp)
    app.register_blueprint(plan_bp)
    app.register_blueprint(membership_bp)
    app.register_blueprint(attendance_bp)
    app.register_blueprint(payment_bp)
    app.register_blueprint(workout_bp)
    app.register_blueprint(diet_bp)
    app.register_blueprint(report_bp)
    app.register_blueprint(notification_bp)

    # Ensure upload directory exists
    os.makedirs(Config.UPLOAD_FOLDER, exist_ok=True)

    # Initialize database engine and prepare tables
    try:
        from backend.database import _detect_engine, _ensure_sqlite_ready
        engine = _detect_engine()
        if engine == 'sqlite':
            _ensure_sqlite_ready()
    except Exception as db_err:
        app.logger.warning(f"Database pre-initialization notice: {db_err}")

    # Route: Serve uploads
    @app.route('/uploads/<path:filename>')
    def serve_upload(filename):
        return send_from_directory(Config.UPLOAD_FOLDER, filename)

    # Route: Serve frontend static files
    @app.route('/')
    def index():
        return send_from_directory(Config.FRONTEND_DIR, 'index.html')

    @app.route('/login')
    def login_page():
        return send_from_directory(Config.FRONTEND_DIR, 'login.html')

    @app.route('/admin')
    def admin_page():
        return send_from_directory(Config.FRONTEND_DIR, 'admin-dashboard.html')

    @app.route('/member')
    def member_page():
        return send_from_directory(Config.FRONTEND_DIR, 'member-dashboard.html')

    # Static assets fallback for frontend
    @app.route('/<path:filename>')
    def serve_frontend_static(filename):
        target_path = os.path.join(Config.FRONTEND_DIR, filename)
        if os.path.exists(target_path):
            return send_from_directory(Config.FRONTEND_DIR, filename)
        return jsonify({'error': 'Resource not found', 'path': filename}), 404

    # Centralized error handlers
    @app.errorhandler(404)
    def not_found(e):
        return jsonify({'success': False, 'message': 'Endpoint or resource not found'}), 404

    @app.errorhandler(500)
    def server_error(e):
        return jsonify({'success': False, 'message': 'Internal server error'}), 500

    return app

if __name__ == '__main__':
    app = create_app()
    app.run(host='0.0.0.0', port=Config.FLASK_PORT, debug=Config.DEBUG)
