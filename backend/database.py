import os
import pymysql
import pymysql.cursors
from backend.config import Config

def get_db_connection(use_database=True):
    """Establish and return a PyMySQL connection with DictCursor."""
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
    Execute a parameterized SQL query safely.
    - If commit=True: returns dict with {'lastrowid': id, 'rowcount': count}
    - If one=True: returns a single row dict or None
    - Otherwise: returns a list of row dicts
    """
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
    """Initialize MySQL database schema and optional seed data."""
    root_dir = Config.BASE_DIR.parent
    schema_path = os.path.join(root_dir, 'database', 'schema.sql')
    seed_path = os.path.join(root_dir, 'database', 'seed.sql')

    print("[DB] Executing schema.sql...")
    execute_sql_file(schema_path)
    print("[DB] Schema applied successfully.")

    # Check if seed should run (if users table is empty or force_seed=True)
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
    """Verify MySQL connectivity."""
    try:
        conn = get_db_connection(use_database=False)
        with conn.cursor() as cursor:
            cursor.execute("SELECT VERSION() as version;")
            row = cursor.fetchone()
        conn.close()
        return True, row['version']
    except Exception as ex:
        return False, str(ex)
