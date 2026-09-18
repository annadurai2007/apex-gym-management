import os
import re
import datetime
import sqlite3
import pymysql
import pymysql.cursors
from backend.config import Config

_DB_ENGINE = None
_SQLITE_INITIALIZED = False

def _detect_engine():
    """Detect whether to use MySQL or SQLite. Cache the result for performance."""
    global _DB_ENGINE
    if _DB_ENGINE is not None:
        return _DB_ENGINE

    if Config.USE_SQLITE:
        _DB_ENGINE = 'sqlite'
        print("[DB] Configured for SQLite database mode.")
        return _DB_ENGINE

    try:
        test_conn = pymysql.connect(
            host=Config.DB_HOST,
            port=Config.DB_PORT,
            user=Config.DB_USER,
            password=Config.DB_PASSWORD,
            charset='utf8mb4',
            connect_timeout=3
        )
        test_conn.close()
        _DB_ENGINE = 'mysql'
        print(f"[DB] Connected successfully to MySQL at {Config.DB_HOST}:{Config.DB_PORT}")
        return _DB_ENGINE
    except Exception as ex:
        _DB_ENGINE = 'sqlite'
        print(f"[DB] MySQL connection to {Config.DB_HOST}:{Config.DB_PORT} failed ({ex}).")
        print(f"[DB] Seamlessly switching to SQLite database ({Config.SQLITE_PATH}).")
        return _DB_ENGINE

def _sqlite_date_format(val, fmt):
    if not val:
        return ''
    try:
        if isinstance(val, str):
            clean_val = val.split('.')[0]
            if ' ' in clean_val:
                dt = datetime.datetime.strptime(clean_val, '%Y-%m-%d %H:%M:%S')
            else:
                dt = datetime.datetime.strptime(clean_val[:10], '%Y-%m-%d')
        elif isinstance(val, (datetime.date, datetime.datetime)):
            dt = val
        else:
            return str(val)
        return dt.strftime(fmt)
    except Exception:
        return str(val)

def _sqlite_datediff(d1, d2):
    if not d1 or not d2:
        return 0
    try:
        if isinstance(d1, str):
            dt1 = datetime.datetime.strptime(str(d1)[:10], '%Y-%m-%d').date()
        else:
            dt1 = d1
        if isinstance(d2, str):
            dt2 = datetime.datetime.strptime(str(d2)[:10], '%Y-%m-%d').date()
        else:
            dt2 = d2
        return (dt1 - dt2).days
    except Exception:
        return 0

def _sqlite_field(*args):
    if not args or len(args) < 2:
        return 0
    target = str(args[0])
    for idx, val in enumerate(args[1:], start=1):
        if str(val) == target:
            return idx
    return 0

def _sqlite_dayname(val):
    if not val:
        return ''
    try:
        dt = datetime.datetime.strptime(str(val)[:10], '%Y-%m-%d')
        return dt.strftime('%A')
    except Exception:
        return ''

def _ensure_sqlite_ready():
    """Auto-initialize SQLite schema and seed data if database is empty or missing."""
    global _SQLITE_INITIALIZED
    if _SQLITE_INITIALIZED:
        return

    db_path = Config.SQLITE_PATH
    db_dir = os.path.dirname(db_path)
    if db_dir:
        os.makedirs(db_dir, exist_ok=True)

    needs_init = True
    if os.path.exists(db_path):
        try:
            conn = sqlite3.connect(db_path)
            cur = conn.cursor()
            cur.execute("SELECT count(*) FROM sqlite_master WHERE type='table' AND name='role_permissions';")
            exists = cur.fetchone()[0]
            if exists:
                cur.execute("SELECT count(*) FROM role_permissions;")
                count = cur.fetchone()[0]
                if count > 0:
                    needs_init = False
            conn.close()
        except Exception:
            needs_init = True

    if needs_init:
        print("[DB] Initializing SQLite schema and seed data...")
        root_dir = Config.BASE_DIR.parent
        schema_path = os.path.join(root_dir, 'database', 'sqlite_schema.sql')
        seed_path = os.path.join(root_dir, 'database', 'sqlite_seed.sql')

        conn = sqlite3.connect(db_path)
        conn.create_function("CURDATE", 0, lambda: datetime.date.today().isoformat())
        conn.create_function("NOW", 0, lambda: datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S'))
        conn.create_function("FIELD", -1, _sqlite_field)
        conn.create_function("DAYNAME", 1, _sqlite_dayname)
        try:
            with open(schema_path, 'r', encoding='utf-8') as f:
                conn.executescript(f.read())
            with open(seed_path, 'r', encoding='utf-8') as f:
                conn.executescript(f.read())
            conn.commit()
            print("[DB] SQLite database initialized and seeded successfully.")
        except Exception as e:
            print(f"[DB INIT ERROR] SQLite initialization failed: {e}")
            raise e
        finally:
            conn.close()

    _SQLITE_INITIALIZED = True

def get_sqlite_connection():
    """Create and configure an SQLite connection with custom functions and dict row factory."""
    _ensure_sqlite_ready()
    conn = sqlite3.connect(Config.SQLITE_PATH, timeout=20.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.create_function("DATE_FORMAT", 2, _sqlite_date_format)
    conn.create_function("DATEDIFF", 2, _sqlite_datediff)
    conn.create_function("FIELD", -1, _sqlite_field)
    conn.create_function("DAYNAME", 1, _sqlite_dayname)
    conn.create_function("CURDATE", 0, lambda: datetime.date.today().isoformat())
    conn.create_function("NOW", 0, lambda: datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S'))
    return conn

def get_db_connection(use_database=True):
    """Establish and return a database connection (MySQL or SQLite)."""
    engine = _detect_engine()
    if engine == 'sqlite':
        return get_sqlite_connection()

    db_name = Config.DB_NAME if use_database else None
    return pymysql.connect(
        host=Config.DB_HOST,
        port=Config.DB_PORT,
        user=Config.DB_USER,
        password=Config.DB_PASSWORD,
        database=db_name,
        charset='utf8mb4',
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=True
    )

def query_db(query, args=None, one=False, commit=False):
    """
    Execute a parameterized SQL query safely across MySQL or SQLite.
    - If commit=True: returns dict with {'lastrowid': id, 'rowcount': count}
    - If one=True: returns a single row dict or None
    - Otherwise: returns a list of row dicts
    """
    engine = _detect_engine()
    if engine == 'sqlite':
        sqlite_query = re.sub(r'(?<!%)%s', '?', query)
        conn = get_sqlite_connection()
        try:
            cursor = conn.cursor()
            if args:
                cursor.execute(sqlite_query, args)
            else:
                cursor.execute(sqlite_query)
            if commit:
                conn.commit()
                return {
                    'lastrowid': cursor.lastrowid,
                    'rowcount': cursor.rowcount
                }
            if one:
                row = cursor.fetchone()
                return dict(row) if row else None
            else:
                rows = cursor.fetchall()
                return [dict(row) for row in rows]
        finally:
            conn.close()
    else:
        conn = get_db_connection()
        try:
            with conn.cursor() as cursor:
                if args:
                    cursor.execute(query, args)
                else:
                    cursor.execute(query)
                if commit:
                    conn.commit()
                    return {
                        'lastrowid': cursor.lastrowid,
                        'rowcount': cursor.rowcount
                    }
                result = cursor.fetchone() if one else cursor.fetchall()
                return result
        finally:
            conn.close()

def execute_sql_file(file_path):
    """Execute all SQL statements in a file cleanly handling comments."""
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"SQL file not found: {file_path}")
        
    with open(file_path, 'r', encoding='utf-8') as f:
        sql_content = f.read()

    # Remove multi-line comments /* ... */
    import re
    sql_clean = re.sub(r'/\*.*?\*/', '', sql_content, flags=re.DOTALL)
    
    # Process lines: remove trailing line comments and assemble statements
    statements = []
    current_statement = []
    
    for raw_line in sql_clean.splitlines():
        line = raw_line.strip()
        # Remove single-line comments starting with -- or #
        if '--' in line:
            # Only strip if -- is not inside quotes
            parts = line.split('--', 1)
            line = parts[0].strip()
        if '#' in line:
            parts = line.split('#', 1)
            line = parts[0].strip()
            
        if not line:
            continue
            
        current_statement.append(line)
        if line.endswith(';'):
            stmt = " ".join(current_statement)
            if stmt.endswith(';'):
                stmt = stmt[:-1].strip()
            if stmt:
                statements.append(stmt)
            current_statement = []
            
    if current_statement:
        stmt = " ".join(current_statement).strip()
        if stmt:
            statements.append(stmt)

    conn = get_db_connection(use_database=False)
    try:
        with conn.cursor() as cursor:
            for stmt in statements:
                cleaned = stmt.strip()
                if cleaned:
                    try:
                        cursor.execute(cleaned)
                    except Exception as err:
                        print(f"[DB INIT ERROR] Failed statement:\n{cleaned[:160]}...\nError: {err}")
                        raise err
        conn.commit()
    finally:
        conn.close()

def init_database(force_seed=False):
    """Initialize database schema and optional seed data for active engine."""
    engine = _detect_engine()
    root_dir = Config.BASE_DIR.parent
    if engine == 'sqlite':
        global _SQLITE_INITIALIZED
        _SQLITE_INITIALIZED = False
        if force_seed and os.path.exists(Config.SQLITE_PATH):
            os.remove(Config.SQLITE_PATH)
        _ensure_sqlite_ready()
    else:
        schema_path = os.path.join(root_dir, 'database', 'schema.sql')
        seed_path = os.path.join(root_dir, 'database', 'seed.sql')

        print("[DB] Executing schema.sql...")
        execute_sql_file(schema_path)
        print("[DB] Schema applied successfully.")

        should_seed = force_seed
        if not should_seed:
            try:
                users = query_db("SELECT COUNT(*) as count FROM users", one=True)
                if users and users['count'] == 0:
                    should_seed = True
            except Exception:
                should_seed = True

        if should_seed:
            print("[DB] Executing seed.sql...")
            execute_sql_file(seed_path)
            print("[DB] Seed data loaded successfully.")
        else:
            print("[DB] Database already populated. Skipping seed.")

def check_database_connection():
    """Verify database connectivity."""
    try:
        engine = _detect_engine()
        if engine == 'sqlite':
            conn = get_sqlite_connection()
            cur = conn.cursor()
            cur.execute("SELECT sqlite_version() as version;")
            row = cur.fetchone()
            conn.close()
            return True, f"SQLite {row['version']}"
        else:
            conn = get_db_connection(use_database=False)
            with conn.cursor() as cursor:
                cursor.execute("SELECT VERSION() as version;")
                row = cursor.fetchone()
            conn.close()
            return True, f"MySQL {row['version']}"
    except Exception as ex:
        return False, str(ex)
