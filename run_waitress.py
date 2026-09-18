import sys
from pathlib import Path

root_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(root_dir))

from backend.config import Config
from backend.database import check_database_connection
from backend.app import create_app

def main():
    connected, info = check_database_connection()
    if not connected:
        print(f"[!] Database connection error: {info}")
        sys.exit(1)
    
    print(f"[+] MySQL connected: {info}")
    print(f"[*] Starting APEX FITNESS on Waitress WSGI server (http://0.0.0.0:{Config.FLASK_PORT})...")
    
    try:
        from waitress import serve
        app = create_app()
        serve(app, host="0.0.0.0", port=Config.FLASK_PORT, threads=8)
    except ImportError:
        print("[!] Waitress not installed. Running with default server...")
        app = create_app()
        app.run(host="0.0.0.0", port=Config.FLASK_PORT)

if __name__ == "__main__":
    main()
