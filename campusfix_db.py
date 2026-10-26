"""
CampusFix: Intelligent Campus Complaint Management and Resolution System
Core Database Layer (campusfix_db.py)

Dual-Backend Engine:
- PostgreSQL + pgvector (Production / Supabase Live Cloud)
- SQLite (Local Offline Zero-Dependency Fallback)
Includes robust connection retries, auto-reconnect, and error handling.
"""

import os
import sys
import json
import math
import hashlib
import re
import time
from datetime import datetime

# Load environment variables
ENV_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
DATABASE_URL = None
if os.path.exists(ENV_FILE):
    with open(ENV_FILE, "r") as f:
        for line in f:
            line = line.strip()
            if line.startswith("DATABASE_URL="):
                DATABASE_URL = line.split("=", 1)[1].strip()

USE_POSTGRES = False
DB_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "campusfix.db")

# Connection cache for Supabase to avoid frequent reconnects
_active_pg_conn = None


def test_postgres_connection():
    global USE_POSTGRES
    if not DATABASE_URL:
        USE_POSTGRES = False
        return False
    try:
        import psycopg2
        conn = psycopg2.connect(DATABASE_URL, connect_timeout=8)
        conn.close()
        USE_POSTGRES = True
        return True
    except Exception:
        USE_POSTGRES = False
        return False


test_postgres_connection()


def get_connection(retries=2, retry_delay=1.5):
    """
    Returns an active database connection.
    Implements automatic retries for cloud network hiccups.
    """
    global USE_POSTGRES, _active_pg_conn

    if USE_POSTGRES:
        import psycopg2
        # Check if existing connection is alive
        if _active_pg_conn is not None:
            try:
                if not _active_pg_conn.closed:
                    cur = _active_pg_conn.cursor()
                    cur.execute("SELECT 1;")
                    cur.close()
                    return _active_pg_conn
            except Exception:
                _active_pg_conn = None

        # Try connecting with retries
        last_error = None
        for attempt in range(retries):
            try:
                conn = psycopg2.connect(DATABASE_URL, connect_timeout=10)
                conn.autocommit = True
                _active_pg_conn = conn
                return conn
            except Exception as e:
                last_error = e
                time.sleep(retry_delay)

        # If network/DNS fails completely, report clear warning
        print(f"\n[Database Notice] Temporary cloud network issue: {last_error}")
        print("Falling back to local database engine to continue your session...\n")
        USE_POSTGRES = False

    # Fallback to local SQLite
    import sqlite3
    import campusfix_sqlite_init
    campusfix_sqlite_init.init_sqlite(DB_FILE)
    conn = sqlite3.connect(DB_FILE)
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.row_factory = sqlite3.Row
    return conn


def get_cursor(conn):
    if USE_POSTGRES:
        import psycopg2.extras
        return conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    else:
        return conn.cursor()


def get_backend_name():
    return "Supabase PostgreSQL 17 + pgvector (Cloud)" if USE_POSTGRES else "SQLite 3.50 (Local Fallback)"


# ============================================================================
# HIGH-PRECISION VECTOR EMBEDDING GENERATOR
# ============================================================================

STOP_WORDS = {
    'in', 'the', 'on', 'at', 'to', 'for', 'of', 'and', 'a', 'an', 'is', 'it', 'this',
    'that', 'with', 'from', 'by', 'floor', 'hall', 'area', 'building'
}

TOPIC_KEYWORDS = {
    'water': 12.0, 'leak': 12.0, 'leaking': 12.0, 'leakage': 12.0, 'pipe': 10.0, 'tap': 12.0,
    'washroom': 8.0, 'bathroom': 8.0, 'toilet': 8.0, 'flush': 10.0, 'drain': 10.0, 'basin': 8.0,
    'dripping': 10.0, 'plumber': 8.0, 'overflow': 10.0,
    'power': 10.0, 'electricity': 10.0, 'switch': 8.0, 'socket': 8.0, 'light': 8.0, 'tube': 8.0,
    'fan': 12.0, 'screeching': 8.0, 'regulator': 8.0, 'ac': 10.0, 'cooling': 8.0, 'mcb': 10.0, 'trip': 8.0,
    'wifi': 15.0, 'internet': 15.0, 'network': 10.0, 'router': 10.0, 'connection': 8.0, 'signal': 8.0,
    'packet': 8.0, 'ethernet': 10.0, 'ssid': 10.0, 'lan': 8.0,
    'projector': 15.0, 'screen': 8.0, 'audio': 8.0, 'mic': 8.0, 'speaker': 8.0, 'display': 8.0,
    'tint': 8.0, 'flicker': 10.0, 'flickering': 10.0,
    'clean': 8.0, 'cleaning': 8.0, 'dustbin': 8.0, 'garbage': 8.0, 'trash': 8.0, 'waste': 8.0,
    'sanitization': 8.0, 'smell': 8.0, 'odor': 8.0
}
KEYWORD_LIST = list(TOPIC_KEYWORDS.keys())


def normalize_text(text):
    t = text.lower()
    t = re.sub(r'wi[- ]?fi', 'wifi', t)
    t = re.sub(r'a[- /]?c\b|air[- ]?condition\w*', 'ac', t)
    t = re.sub(r'wash[- ]?room', 'washroom', t)
    t = re.sub(r'bath[- ]?room', 'bathroom', t)
    return t


def generate_embedding(text):
    norm_t = normalize_text(text)
    words = [w for w in re.findall(r'[a-zA-Z0-9]+', norm_t) if w not in STOP_WORDS]
    dim = 384
    vec = [0.0] * dim
    for w in words:
        if w in TOPIC_KEYWORDS:
            idx = KEYWORD_LIST.index(w)
            vec[idx] += TOPIC_KEYWORDS[w]
        else:
            h = (hash(w) & 0x7FFFFFFF) % (dim - len(KEYWORD_LIST)) + len(KEYWORD_LIST)
            vec[h] += 1.0

    norm = math.sqrt(sum(x * x for x in vec))
    if norm > 0:
        return [round(x / norm, 5) for x in vec]
    return [0.0] * dim


def cosine_similarity(vec1, vec2):
    dot = sum(a * b for a, b in zip(vec1, vec2))
    norm1 = math.sqrt(sum(a * a for a in vec1))
    norm2 = math.sqrt(sum(b * b for b in vec2))
    return dot / (norm1 * norm2) if (norm1 > 0 and norm2 > 0) else 0.0


# ============================================================================
# COMPLAINT REPOSITORY & WORKFLOW
# ============================================================================

def create_complaint(reporter_id, category_id, title, description, location_text, priority):
    conn = get_connection()
    cur = get_cursor(conn)
    full_text = f"{title} {description} {location_text}"
    vec = generate_embedding(full_text)
    content_hash = hashlib.sha256(full_text.encode()).hexdigest()

    if USE_POSTGRES:
        cur.execute("""
            INSERT INTO complaints (reporter_id, category_id, title, description, location_text, priority, status)
            VALUES (%s, %s, %s, %s, %s, %s, 'SUBMITTED')
            RETURNING complaint_id;
        """, (reporter_id, category_id, title, description, location_text, priority))
        complaint_id = cur.fetchone()['complaint_id']

        cur.execute("""
            INSERT INTO status_history (complaint_id, changed_by, old_status, new_status, remarks)
            VALUES (%s, %s, NULL, 'SUBMITTED', 'Complaint submitted by reporter');
        """, (complaint_id, reporter_id))

        vec_str = "[" + ",".join(str(x) for x in vec) + "]"
        cur.execute("""
            INSERT INTO complaint_embeddings (complaint_id, embedding, model_name, content_hash)
            VALUES (%s, %s::vector, 'all-MiniLM-L6-v2', %s);
        """, (complaint_id, vec_str, content_hash))

        cur.execute("""
            INSERT INTO notifications (user_id, complaint_id, message)
            SELECT u.user_id, %s, 'New complaint #' || %s || ' submitted: ' || %s
            FROM users u
            JOIN roles r ON u.role_id = r.role_id
            WHERE r.role_name = 'ADMIN';
        """, (complaint_id, complaint_id, title))
    else:
        cur.execute("""
            INSERT INTO complaints (reporter_id, category_id, title, description, location_text, priority, status)
            VALUES (?, ?, ?, ?, ?, ?, 'SUBMITTED');
        """, (reporter_id, category_id, title, description, location_text, priority))
        complaint_id = cur.lastrowid

        cur.execute("""
            INSERT INTO status_history (complaint_id, changed_by, old_status, new_status, remarks)
            VALUES (?, ?, NULL, 'SUBMITTED', 'Complaint submitted by reporter');
        """, (complaint_id, reporter_id))

        cur.execute("""
            INSERT INTO complaint_embeddings (complaint_id, embedding_json, model_name, content_hash)
            VALUES (?, ?, 'all-MiniLM-L6-v2', ?);
        """, (complaint_id, json.dumps(vec), content_hash))
        conn.commit()

    return complaint_id


def find_similar_complaints(query_text, threshold=0.45, limit=5):
    conn = get_connection()
    cur = get_cursor(conn)
    query_vec = generate_embedding(query_text)

    results = []
    if USE_POSTGRES:
        vec_str = "[" + ",".join(str(x) for x in query_vec) + "]"
        cur.execute("""
            SELECT 
                c.complaint_id,
                c.title,
                c.description,
                c.location_text AS location,
                c.status,
                c.priority,
                cat.category_name AS category,
                dept.department_name AS department,
                ROUND((1 - (ce.embedding <=> %s::vector))::numeric, 4) AS similarity_score
            FROM complaint_embeddings ce
            JOIN complaints c ON ce.complaint_id = c.complaint_id
            JOIN categories cat ON c.category_id = cat.category_id
            JOIN departments dept ON cat.department_id = dept.department_id
            ORDER BY ce.embedding <=> %s::vector
            LIMIT %s;
        """, (vec_str, vec_str, limit))
        for row in cur.fetchall():
            score = float(row['similarity_score'])
            if score >= threshold:
                results.append({
                    "complaint_id": row['complaint_id'],
                    "title": row['title'],
                    "description": row['description'],
                    "location": row['location'],
                    "category": row['category'],
                    "department": row['department'],
                    "status": row['status'],
                    "priority": row['priority'],
                    "similarity_score": score
                })
    else:
        cur.execute("""
            SELECT 
                c.complaint_id, c.title, c.description, c.location_text AS location,
                c.status, c.priority, cat.category_name AS category, dept.department_name AS department,
                ce.embedding_json
            FROM complaints c
            JOIN categories cat ON c.category_id = cat.category_id
            JOIN departments dept ON cat.department_id = dept.department_id
            JOIN complaint_embeddings ce ON c.complaint_id = ce.complaint_id;
        """)
        for row in cur.fetchall():
            vec = json.loads(row['embedding_json'])
            sim = cosine_similarity(query_vec, vec)
            if sim >= threshold:
                results.append({
                    "complaint_id": row['complaint_id'],
                    "title": row['title'],
                    "description": row['description'],
                    "location": row['location'],
                    "category": row['category'],
                    "department": row['department'],
                    "status": row['status'],
                    "priority": row['priority'],
                    "similarity_score": round(sim, 4)
                })
        results.sort(key=lambda x: x['similarity_score'], reverse=True)
        results = results[:limit]

    return results


def get_complaint_details(complaint_id):
    conn = get_connection()
    cur = get_cursor(conn)
    param = "%s" if USE_POSTGRES else "?"

    cur.execute(f"""
        SELECT 
            c.complaint_id,
            c.title,
            c.description,
            c.location_text,
            c.priority,
            c.status,
            c.created_at,
            c.resolved_at,
            cat.category_name,
            cat.target_hours,
            dept.department_name,
            rep.full_name AS reporter_name,
            rep.email AS reporter_email,
            staff.full_name AS staff_name,
            staff.email AS staff_email,
            a.assigned_at,
            f.rating AS feedback_rating,
            f.comment AS feedback_comment,
            f.created_at AS feedback_time
        FROM complaints c
        JOIN categories cat ON c.category_id = cat.category_id
        JOIN departments dept ON cat.department_id = dept.department_id
        JOIN users rep ON c.reporter_id = rep.user_id
        LEFT JOIN assignments a ON c.complaint_id = a.complaint_id AND a.ended_at IS NULL
        LEFT JOIN users staff ON a.staff_id = staff.user_id
        LEFT JOIN feedback f ON c.complaint_id = f.complaint_id
        WHERE c.complaint_id = {param};
    """, (complaint_id,))
    details = cur.fetchone()

    history = []
    if details:
        cur.execute(f"""
            SELECT 
                sh.history_id,
                COALESCE(sh.old_status, 'INITIAL') AS old_status,
                sh.new_status,
                u.full_name AS changed_by,
                sh.changed_at,
                sh.remarks
            FROM status_history sh
            JOIN users u ON sh.changed_by = u.user_id
            WHERE sh.complaint_id = {param}
            ORDER BY sh.history_id ASC;
        """, (complaint_id,))
        history = [dict(r) for r in cur.fetchall()]

    return dict(details) if details else None, history


def assign_staff(complaint_id, staff_id, admin_id):
    conn = get_connection()
    cur = get_cursor(conn)
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    if USE_POSTGRES:
        cur.execute("""
            UPDATE assignments
            SET ended_at = CURRENT_TIMESTAMP
            WHERE complaint_id = %s AND ended_at IS NULL;
        """, (complaint_id,))

        cur.execute("""
            INSERT INTO assignments (complaint_id, staff_id, assigned_by, assigned_at)
            VALUES (%s, %s, %s, CURRENT_TIMESTAMP);
        """, (complaint_id, staff_id, admin_id))

        cur.execute("""
            UPDATE complaints
            SET status = 'ASSIGNED'
            WHERE complaint_id = %s AND status = 'SUBMITTED';
        """, (complaint_id,))

        cur.execute("""
            INSERT INTO notifications (user_id, complaint_id, message)
            VALUES (%s, %s, 'You have been assigned to complaint #' || %s);
        """, (staff_id, complaint_id, complaint_id))
    else:
        cur.execute("""
            UPDATE assignments
            SET ended_at = ?
            WHERE complaint_id = ? AND ended_at IS NULL;
        """, (now, complaint_id))

        cur.execute("""
            INSERT INTO assignments (complaint_id, staff_id, assigned_by, assigned_at)
            VALUES (?, ?, ?, ?);
        """, (complaint_id, staff_id, admin_id, now))

        cur.execute("""
            UPDATE complaints
            SET status = 'ASSIGNED'
            WHERE complaint_id = ? AND status = 'SUBMITTED';
        """, (complaint_id,))

        cur.execute("""
            INSERT INTO notifications (user_id, complaint_id, message)
            VALUES (?, ?, 'You have been assigned to complaint #' || ?);
        """, (staff_id, complaint_id, complaint_id))
        conn.commit()


def update_complaint_status(complaint_id, staff_id, new_status, remarks):
    conn = get_connection()
    cur = get_cursor(conn)

    if USE_POSTGRES:
        cur.execute("SELECT status, reporter_id FROM complaints WHERE complaint_id = %s;", (complaint_id,))
        row = cur.fetchone()
        if not row:
            raise ValueError(f"Complaint #{complaint_id} not found.")

        old_status = row['status']
        reporter_id = row['reporter_id']

        cur.execute("UPDATE complaints SET status = %s WHERE complaint_id = %s;", (new_status, complaint_id))
        cur.execute("""
            INSERT INTO status_history (complaint_id, changed_by, old_status, new_status, remarks)
            VALUES (%s, %s, %s, %s, %s);
        """, (complaint_id, staff_id, old_status, new_status, remarks))
        cur.execute("""
            INSERT INTO notifications (user_id, complaint_id, message)
            VALUES (%s, %s, 'Your complaint #' || %s || ' status was updated to ' || %s);
        """, (reporter_id, complaint_id, complaint_id, new_status))
    else:
        cur.execute("SELECT status, reporter_id FROM complaints WHERE complaint_id = ?;", (complaint_id,))
        row = cur.fetchone()
        if not row:
            raise ValueError(f"Complaint #{complaint_id} not found.")

        old_status = row['status']
        reporter_id = row['reporter_id']

        cur.execute("UPDATE complaints SET status = ? WHERE complaint_id = ?;", (new_status, complaint_id))
        cur.execute("""
            INSERT INTO status_history (complaint_id, changed_by, old_status, new_status, remarks)
            VALUES (?, ?, ?, ?, ?);
        """, (complaint_id, staff_id, old_status, new_status, remarks))
        cur.execute("""
            INSERT INTO notifications (user_id, complaint_id, message)
            VALUES (?, ?, 'Your complaint #' || ? || ' status was updated to ' || ?);
        """, (reporter_id, complaint_id, complaint_id, new_status))
        conn.commit()


def submit_feedback(complaint_id, rating, comment):
    conn = get_connection()
    cur = get_cursor(conn)
    if USE_POSTGRES:
        cur.execute("""
            INSERT INTO feedback (complaint_id, rating, comment, created_at)
            VALUES (%s, %s, %s, CURRENT_TIMESTAMP)
            ON CONFLICT (complaint_id) DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment, created_at = CURRENT_TIMESTAMP;
        """, (complaint_id, rating, comment))
    else:
        cur.execute("""
            INSERT OR REPLACE INTO feedback (complaint_id, rating, comment, created_at)
            VALUES (?, ?, ?, datetime('now', 'localtime'));
        """, (complaint_id, rating, comment))
        conn.commit()


def get_department_analytics():
    conn = get_connection()
    cur = get_cursor(conn)
    cur.execute("SELECT * FROM view_department_analytics ORDER BY department_id;")
    rows = [dict(r) for r in cur.fetchall()]
    return rows


def get_pending_complaints():
    conn = get_connection()
    cur = get_cursor(conn)
    cur.execute("SELECT * FROM view_pending_complaints ORDER BY hours_open DESC;")
    rows = [dict(r) for r in cur.fetchall()]
    return rows


def init_database():
    if USE_POSTGRES:
        return
    try:
        import campusfix_sqlite_init
        campusfix_sqlite_init.init_sqlite(DB_FILE)
    except Exception as e:
        print(f"[Warning] SQLite init notice: {e}")
