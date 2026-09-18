import sys
import os
import argparse
from pathlib import Path

# Ensure root directory is in python path
root_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(root_dir))

from backend.config import Config
from backend.database import init_database, check_database_connection
from backend.app import create_app

def print_banner():
    banner = f"""
========================================================================
   ___    ____  _______  __   ________________  __________________
  /   |  / __ \\/ ____/ |/ /  / ____/  _/_  __/ |/ / ____/ ___/ ___/
 / /| | / /_/ / __/  |   /  / /_   / /  / /  |   / __/  \\__ \\\\__ \\ 
/ ___ |/ ____/ /___ /   |  / __/ _/ /  / /  /   / /___ ___/ /__/ / 
/_/  |_/_/   /_____//_/|_| /_/   /___/ /_/  /_/|_/_____//____/____/  
========================================================================
   PREMIUM GYM MANAGEMENT SYSTEM — PRODUCTION ARCHITECTURE
------------------------------------------------------------------------
   API Server:       http://127.0.0.1:{Config.FLASK_PORT}
   Landing Page:     http://127.0.0.1:{Config.FLASK_PORT}/
   Login Portal:     http://127.0.0.1:{Config.FLASK_PORT}/login
   Admin Dashboard:  http://127.0.0.1:{Config.FLASK_PORT}/admin
   Member Portal:    http://127.0.0.1:{Config.FLASK_PORT}/member
------------------------------------------------------------------------
   DEMO CREDENTIALS:
   * Admin:   admin@apexgym.com   / Admin@123
   * Trainer: marcus@apexgym.com  / Trainer@123
   * Member:  alex@apexgym.com    / Member@123
   * Member:  sarah@apexgym.com   / Member@123 (Expiring in 3 days)
========================================================================
"""
    print(banner)

def main():
    parser = argparse.ArgumentParser(description="Apex Gym Management System Runner")
    parser.add_argument('--init-db', action='store_true', help="Initialize MySQL schema and seed data")
    parser.add_argument('--seed', action='store_true', help="Reload seed data")
    parser.add_argument('--port', type=int, default=Config.FLASK_PORT, help="Port to run Flask server")
    args = parser.parse_args()

    # Check MySQL connectivity
    connected, info = check_database_connection()
    if not connected:
        print(f"[!] Warning: Cannot connect to MySQL on {Config.DB_HOST}:{Config.DB_PORT}")
        print(f"    Error: {info}")
        print("    Please ensure MySQL/MariaDB is running.")
        sys.exit(1)
    else:
        print(f"[+] MySQL Server connected: {info}")

    if args.init_db or args.seed:
        print("[*] Initializing database...")
        init_database(force_seed=True)
        print("[+] Database initialization finished.")
        if args.init_db and not args.seed and len(sys.argv) <= 2:
            return

    # Check if database already has tables; if not, initialize automatically
    try:
        from backend.database import query_db
        query_db("SELECT 1 FROM users LIMIT 1")
    except Exception:
        print("[*] Database tables not found. Initializing schema and seed data...")
        init_database(force_seed=True)

    print_banner()
    app = create_app()
    app.run(host='0.0.0.0', port=args.port, debug=Config.DEBUG)

if __name__ == '__main__':
    main()
