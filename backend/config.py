import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from backend directory or project root
backend_dir = Path(__file__).resolve().parent
root_dir = backend_dir.parent

load_dotenv(backend_dir / '.env')
load_dotenv(root_dir / '.env')

class Config:
    # Database Settings
    DB_HOST = os.getenv('DB_HOST', '127.0.0.1')
    DB_PORT = int(os.getenv('DB_PORT', 3306))
    DB_USER = os.getenv('DB_USER', 'root')
    DB_PASSWORD = os.getenv('DB_PASSWORD', '')
    DB_NAME = os.getenv('DB_NAME', 'gym_management_db')

    # Security
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'apex_gym_jwt_secret_token_key_2026_super_secure')
    JWT_EXPIRES_HOURS = int(os.getenv('JWT_EXPIRES_HOURS', 24))

    # Application
    DEBUG = os.getenv('DEBUG', 'True').lower() in ('true', '1', 't')
    FLASK_PORT = int(os.getenv('FLASK_PORT', 5000))
    CORS_ORIGIN = os.getenv('CORS_ORIGIN', '*')

    # Uploads
    BASE_DIR = backend_dir
    UPLOAD_FOLDER = os.path.join(backend_dir, os.getenv('UPLOAD_FOLDER', 'uploads'))
    MAX_CONTENT_LENGTH = int(os.getenv('MAX_CONTENT_LENGTH', 16 * 1024 * 1024)) # 16 MB
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp'}

    # Frontend folder path
    FRONTEND_DIR = os.path.join(root_dir, 'frontend')
