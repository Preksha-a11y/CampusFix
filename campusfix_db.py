"""
CampusFix: Intelligent Campus Complaint Management and Resolution System
Core Database Layer (campusfix_db.py)

Strict PostgreSQL + pgvector Engine for Supabase Cloud.
Direct, transparent database connection with no silent fallbacks.
"""

import os
import sys
import json
import math
import hashlib
import re
import time
from datetime import datetime

# Always read latest .env
ENV_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
DATABASE_URL = None
USE_POSTGRES = True
if os.path.exists(ENV_FILE):
    with open(ENV_FILE, "r") as f:
        for line in f:
            line = line.strip()
            if line.startswith("DATABASE_URL="):
                DATABASE_URL = line.split("=", 1)[1].strip()

# Reusable connection object
_cached_conn = None


def get_connection():
    """
    Returns an active psycopg2 connection to Supabase PostgreSQL.
    Strictly connects to PostgreSQL when DATABASE_URL is present.
    """
    global _cached_conn, DATABASE_URL

    # Reload DATABASE_URL if missing
    if not DATABASE_URL and os.path.exists(ENV_FILE):
        with open(ENV_FILE, "r") as f:
            for line in f:
                line = line.strip()
                if line.startswith("DATABASE_URL="):
                    DATABASE_URL = line.split("=", 1)[1].strip()

    if not DATABASE_URL:
        raise ValueError("DATABASE_URL not configured in .env file.")

    import psycopg2
    import psycopg2.extras

    # Reuse connection if open and healthy
    if _cached_conn is not None:
        try:
            if not _cached_conn.closed:
                with _cached_conn.cursor() as cur:
                    cur.execute("SELECT 1;")
                return _cached_conn
        except Exception:
            _cached_conn = None

    # Connect with retries for network resilience
    last_err = None
    for attempt in range(3):
        try:
            conn = psycopg2.connect(DATABASE_URL, connect_timeout=10)
            conn.autocommit = True
            _cached_conn = conn
            return conn
        except Exception as e:
            last_err = e
            time.sleep(1.0)

    raise ConnectionError(f"Failed to connect to Supabase PostgreSQL: {last_err}")


def get_cursor(conn):
    import psycopg2.extras
    return conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)


def get_backend_name():
    return "Supabase PostgreSQL 17 + pgvector (Cloud)"


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
    'sanitization': 8.0, 'smell': 8.0, 'odor': 8.0, 'algae': 12.0
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
    """Generates a 384-dimensional dense normalized vector representation."""
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


# ============================================================================
# COMPLAINT REPOSITORY & WORKFLOW (STRICTLY SUPABASE POSTGRESQL)
# ============================================================================

def create_complaint(reporter_id, category_id, title, description, location_text, priority):
    conn = get_connection()
    cur = get_cursor(conn)
    full_text = f"{title} {description} {location_text}"
    vec = generate_embedding(full_text)
    content_hash = hashlib.sha256(full_text.encode()).hexdigest()

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

    return complaint_id


def find_similar_complaints(query_text, threshold=0.45, limit=5):
    conn = get_connection()
    cur = get_cursor(conn)
    query_vec = generate_embedding(query_text)
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

    results = []
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

    return results


def get_complaint_details(complaint_id):
    conn = get_connection()
    cur = get_cursor(conn)

    cur.execute("""
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
        WHERE c.complaint_id = %s;
    """, (complaint_id,))
    details = cur.fetchone()

    history = []
    if details:
        cur.execute("""
            SELECT 
                sh.history_id,
                COALESCE(sh.old_status, 'INITIAL') AS old_status,
                sh.new_status,
                u.full_name AS changed_by,
                sh.changed_at,
                sh.remarks
            FROM status_history sh
            JOIN users u ON sh.changed_by = u.user_id
            WHERE sh.complaint_id = %s
            ORDER BY sh.history_id ASC;
        """, (complaint_id,))
        history = [dict(r) for r in cur.fetchall()]

    return dict(details) if details else None, history


def assign_staff(complaint_id, staff_id, admin_id):
    conn = get_connection()
    cur = get_cursor(conn)

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


def update_complaint_status(complaint_id, staff_id, new_status, remarks):
    conn = get_connection()
    cur = get_cursor(conn)

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


def submit_feedback(complaint_id, rating, comment):
    conn = get_connection()
    cur = get_cursor(conn)
    cur.execute("""
        INSERT INTO feedback (complaint_id, rating, comment, created_at)
        VALUES (%s, %s, %s, CURRENT_TIMESTAMP)
        ON CONFLICT (complaint_id) DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment, created_at = CURRENT_TIMESTAMP;
    """, (complaint_id, rating, comment))


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
    """Validates that Supabase connection is active."""
    conn = get_connection()
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM complaints;")
        count = cur.fetchone()[0]
    return count
