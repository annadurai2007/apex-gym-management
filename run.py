import sys
import os
import argparse
import webbrowser
import threading
import time
import subprocess
from pathlib import Path

# Ensure root directory is in python path
root_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(root_dir))

from backend.config import Config
from backend.database import init_database, check_database_connection, _detect_engine
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
   DEMO CREDENTIALS (1-CLICK LOGIN AVAILABLE ON LOGIN PAGE):
   * Admin:   admin@apexgym.com   / Admin@123
   * Staff:   staff@apexgym.com   / Staff@123
   * Trainer: marcus@apexgym.com  / Trainer@123
   * Member:  alex@apexgym.com    / Member@123
   * Student: emily@apexgym.com   / Member@123
========================================================================
"""
    print(banner)

def auto_open_browser(port):
    """Automatically launches Google Chrome or default web browser directly to login page."""
    time.sleep(1.2)
    url = f"http://127.0.0.1:{port}/login"
    print(f"\n========================================================")
    print(f" [🌐] Automatically launching Google Chrome at:")
    print(f"      {url}")
    print(f"========================================================\n")
    try:
        # Check standard Windows Chrome installation paths
        chrome_paths = [
            r"C:\Program Files\Google\Chrome\Application\chrome.exe",
            r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
            os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"),
        ]
        opened = False
        for cpath in chrome_paths:
            if os.path.exists(cpath):
                subprocess.Popen([cpath, url])
                opened = True
                break
        if not opened:
            webbrowser.open(url)
    except Exception as e:
        try:
            webbrowser.open(url)
        except Exception:
            pass

def main():
    parser = argparse.ArgumentParser(description="Apex Gym Management System Runner")
    parser.add_argument('--init-db', action='store_true', help="Initialize MySQL schema and seed data")
    parser.add_argument('--seed', action='store_true', help="Reload seed data")
    parser.add_argument('--port', type=int, default=Config.FLASK_PORT, help="Port to run Flask server")
    parser.add_argument('--no-browser', action='store_true', help="Do not automatically launch web browser")
    args = parser.parse_args()

    # Check database connectivity with automatic SQLite fallback
    engine = _detect_engine()
    if engine == 'mysql':
        connected, info = check_database_connection()
        if connected:
            print(f"[+] MySQL Server connected: {info}")
        else:
            print(f"[!] Warning: Cannot connect to MySQL on {Config.DB_HOST}:{Config.DB_PORT}")
            print(f"    Info: {info}")
            print(f"[+] Seamlessly switching to Zero-Config SQLite fallback ({Config.SQLITE_PATH})")
    else:
        print(f"[+] Operating in Zero-Config SQLite Database Mode ({Config.SQLITE_PATH})")

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

    # Trigger automatic Chrome launch in background thread
    if not args.no_browser:
        if not Config.DEBUG or os.environ.get('WERKZEUG_RUN_MAIN') == 'true':
            threading.Thread(target=auto_open_browser, args=(args.port,), daemon=True).start()

    app = create_app()
    app.run(host='0.0.0.0', port=args.port, debug=Config.DEBUG)

if __name__ == '__main__':
    main()
