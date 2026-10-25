"""
CampusFix: SQLite Local Fallback Initializer (campusfix_sqlite_init.py)
Creates all tables, triggers, views, and seeds campus data for local offline usage.
"""

import sqlite3
import hashlib
import json
import math
import os
import re
from datetime import datetime, timedelta

def simple_tokenize(text):
    return [w.lower() for w in re.findall(r'\b[a-zA-Z0-9]{3,}\b', text)]

VOCABULARY = [
    "water", "leak", "leaking", "pipe", "tap", "bathroom", "washroom", "toilet", "flush",
    "power", "electricity", "switch", "socket", "light", "bulb", "fan", "ac", "air", "conditioning",
    "wifi", "internet", "network", "router", "connection", "slow", "down", "ethernet", "lan",
    "projector", "screen", "audio", "mic", "speaker", "board", "marker", "desk", "chair",
    "hostel", "room", "floor", "corridor", "dustbin", "clean", "garbage", "trash", "smell",
    "broken", "damaged", "urgent", "fault", "failure", "ceiling", "window", "door", "lock"
]

def generate_local_embedding(text):
    tokens = simple_tokenize(text)
    dim = len(VOCABULARY)
    vec = [0.0] * dim
    for tok in tokens:
        for i, word in enumerate(VOCABULARY):
            if tok == word or tok.startswith(word) or word.startswith(tok):
                vec[i] += 1.0
    norm = math.sqrt(sum(x * x for x in vec))
    if norm > 0:
        vec = [round(x / norm, 5) for x in vec]
    else:
        h = hashlib.sha256(text.encode('utf-8')).digest()
        vec = [((b % 100) / 100.0) for b in h[:dim]]
        norm = math.sqrt(sum(x * x for x in vec))
        vec = [round(x / norm, 5) for x in vec]
    return vec

def init_sqlite(db_file):
    conn = sqlite3.connect(db_file)
    conn.execute("PRAGMA foreign_keys = ON;")
    cur = conn.cursor()

    cur.executescript("""
    CREATE TABLE IF NOT EXISTS roles (
        role_id INTEGER PRIMARY KEY AUTOINCREMENT,
        role_name TEXT NOT NULL UNIQUE CHECK (role_name IN ('REPORTER', 'STAFF', 'ADMIN'))
    );

    CREATE TABLE IF NOT EXISTS users (
        user_id INTEGER PRIMARY KEY AUTOINCREMENT,
        role_id INTEGER NOT NULL REFERENCES roles(role_id) ON DELETE RESTRICT,
        full_name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS departments (
        department_id INTEGER PRIMARY KEY AUTOINCREMENT,
        department_name TEXT NOT NULL UNIQUE CHECK (length(trim(department_name)) > 0)
    );

    CREATE TABLE IF NOT EXISTS categories (
        category_id INTEGER PRIMARY KEY AUTOINCREMENT,
        department_id INTEGER NOT NULL REFERENCES departments(department_id) ON DELETE RESTRICT,
        category_name TEXT NOT NULL,
        target_hours INTEGER NOT NULL CHECK (target_hours > 0),
        UNIQUE (department_id, category_name)
    );

    CREATE TABLE IF NOT EXISTS complaints (
        complaint_id INTEGER PRIMARY KEY AUTOINCREMENT,
        reporter_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
        category_id INTEGER NOT NULL REFERENCES categories(category_id) ON DELETE RESTRICT,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        location_text TEXT NOT NULL,
        priority TEXT NOT NULL CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
        status TEXT NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN ('SUBMITTED', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'REJECTED')),
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        resolved_at TEXT NULL
    );

    CREATE TABLE IF NOT EXISTS assignments (
        assignment_id INTEGER PRIMARY KEY AUTOINCREMENT,
        complaint_id INTEGER NOT NULL REFERENCES complaints(complaint_id) ON DELETE CASCADE,
        staff_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
        assigned_by INTEGER NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
        assigned_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        ended_at TEXT NULL
    );

    CREATE TABLE IF NOT EXISTS status_history (
        history_id INTEGER PRIMARY KEY AUTOINCREMENT,
        complaint_id INTEGER NOT NULL REFERENCES complaints(complaint_id) ON DELETE CASCADE,
        changed_by INTEGER NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
        old_status TEXT NULL,
        new_status TEXT NOT NULL CHECK (new_status IN ('SUBMITTED', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'REJECTED')),
        changed_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        remarks TEXT NULL
    );

    CREATE TABLE IF NOT EXISTS feedback (
        complaint_id INTEGER PRIMARY KEY REFERENCES complaints(complaint_id) ON DELETE CASCADE,
        rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
        comment TEXT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS complaint_embeddings (
        complaint_id INTEGER PRIMARY KEY REFERENCES complaints(complaint_id) ON DELETE CASCADE,
        embedding_json TEXT NOT NULL,
        model_name TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS notifications (
        notification_id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        complaint_id INTEGER NULL REFERENCES complaints(complaint_id) ON DELETE CASCADE,
        message TEXT NOT NULL,
        is_read INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0, 1)),
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_comp_status ON complaints(status);
    CREATE INDEX IF NOT EXISTS idx_comp_cat ON complaints(category_id);
    CREATE INDEX IF NOT EXISTS idx_comp_rep ON complaints(reporter_id);
    CREATE INDEX IF NOT EXISTS idx_comp_created ON complaints(created_at);
    CREATE INDEX IF NOT EXISTS idx_assign_comp ON assignments(complaint_id);
    CREATE INDEX IF NOT EXISTS idx_hist_comp ON status_history(complaint_id);

    CREATE UNIQUE INDEX IF NOT EXISTS idx_uniq_active_assignment 
    ON assignments(complaint_id) WHERE ended_at IS NULL;

    DROP TRIGGER IF EXISTS trg_complaint_resolve;
    CREATE TRIGGER trg_complaint_resolve
    AFTER UPDATE OF status ON complaints
    WHEN NEW.status = 'RESOLVED' AND OLD.status <> 'RESOLVED'
    BEGIN
        UPDATE complaints
        SET resolved_at = datetime('now', 'localtime')
        WHERE complaint_id = NEW.complaint_id;
    END;

    DROP TRIGGER IF EXISTS trg_complaint_reopen;
    CREATE TRIGGER trg_complaint_reopen
    AFTER UPDATE OF status ON complaints
    WHEN NEW.status <> 'RESOLVED' AND OLD.status = 'RESOLVED'
    BEGIN
        UPDATE complaints
        SET resolved_at = NULL
        WHERE complaint_id = NEW.complaint_id;
    END;

    DROP TRIGGER IF EXISTS trg_complaint_status_history;
    CREATE TRIGGER trg_complaint_status_history
    AFTER UPDATE OF status ON complaints
    WHEN NEW.status <> OLD.status
    BEGIN
        INSERT INTO status_history (
            complaint_id, changed_by, old_status, new_status, changed_at, remarks
        ) VALUES (
            NEW.complaint_id, NEW.reporter_id, OLD.status, NEW.status, datetime('now', 'localtime'),
            'Status transitioned from ' || OLD.status || ' to ' || NEW.status
        );
    END;

    DROP VIEW IF EXISTS view_pending_complaints;
    CREATE VIEW view_pending_complaints AS
    SELECT 
        c.complaint_id, c.title, c.description, c.location_text, c.priority, c.status, c.created_at,
        cat.category_name, cat.target_hours, dept.department_id, dept.department_name,
        rep.user_id AS reporter_id, rep.full_name AS reporter_name, rep.email AS reporter_email,
        staff.user_id AS staff_id, staff.full_name AS staff_name, a.assigned_at,
        ROUND((julianday('now', 'localtime') - julianday(c.created_at)) * 24.0, 2) AS hours_open,
        CASE WHEN ((julianday('now', 'localtime') - julianday(c.created_at)) * 24.0) > cat.target_hours THEN 1 ELSE 0 END AS is_overdue
    FROM complaints c
    JOIN categories cat ON c.category_id = cat.category_id
    JOIN departments dept ON cat.department_id = dept.department_id
    JOIN users rep ON c.reporter_id = rep.user_id
    LEFT JOIN assignments a ON c.complaint_id = a.complaint_id AND a.ended_at IS NULL
    LEFT JOIN users staff ON a.staff_id = staff.user_id
    WHERE c.status NOT IN ('RESOLVED', 'REJECTED');

    DROP VIEW IF EXISTS view_department_analytics;
    CREATE VIEW view_department_analytics AS
    SELECT 
        d.department_id, d.department_name,
        COUNT(c.complaint_id) AS total_complaints,
        COUNT(CASE WHEN c.status IN ('SUBMITTED', 'ASSIGNED', 'IN_PROGRESS') THEN 1 END) AS pending_complaints,
        COUNT(CASE WHEN c.status = 'RESOLVED' THEN 1 END) AS resolved_complaints,
        COUNT(CASE WHEN c.status = 'REJECTED' THEN 1 END) AS rejected_complaints,
        ROUND(AVG(CASE WHEN c.status = 'RESOLVED' THEN (julianday(c.resolved_at) - julianday(c.created_at)) * 24.0 END), 2) AS avg_resolution_hours,
        ROUND(AVG(f.rating), 2) AS avg_satisfaction_rating
    FROM departments d
    LEFT JOIN categories cat ON d.department_id = cat.department_id
    LEFT JOIN complaints c ON cat.category_id = c.category_id
    LEFT JOIN feedback f ON c.complaint_id = f.complaint_id
    GROUP BY d.department_id, d.department_name;
    """)

    # Seed data if empty
    cur.execute("SELECT COUNT(*) FROM roles;")
    if cur.fetchone()[0] == 0:
        cur.executemany("INSERT INTO roles (role_name) VALUES (?);", [('REPORTER',), ('STAFF',), ('ADMIN',)])
        demo_pass = hashlib.sha256("password123".encode()).hexdigest()
        users = [
            (1, "Aarav Sharma (Student)", "aarav.sharma@pes.edu", demo_pass),
            (1, "Sneha Rao (Student)", "sneha.rao@pes.edu", demo_pass),
            (1, "Dr. K. Swaminathan (Faculty)", "swaminathan.k@pes.edu", demo_pass),
            (2, "Ramesh K (Electrician)", "ramesh.electrician@pes.edu", demo_pass),
            (2, "Suresh Patel (Plumber)", "suresh.plumber@pes.edu", demo_pass),
            (2, "Anand V (Network Admin)", "anand.network@pes.edu", demo_pass),
            (2, "Mariyappa (Housekeeping Lead)", "mariyappa.clean@pes.edu", demo_pass),
            (3, "Campus Estate Admin", "admin.campusfix@pes.edu", demo_pass)
        ]
        cur.executemany("INSERT INTO users (role_id, full_name, email, password_hash) VALUES (?, ?, ?, ?);", users)

        depts = [("Electrical Maintenance",), ("Estate & Plumbing",), ("IT & Network Infrastructure",), ("Housekeeping & Sanitation",), ("Classroom & AV Facilities",)]
        cur.executemany("INSERT INTO departments (department_name) VALUES (?);", depts)

        cats = [
            (1, "Power Outage / MCB Trip", 4),
            (1, "Ceiling Fan / Tube Light Fault", 12),
            (1, "AC Cooling Failure", 24),
            (2, "Water Tap Leakage", 8),
            (2, "Ceiling Pipe Water Leaking", 6),
            (2, "Blocked Washroom Drain", 4),
            (3, "Hostel Wi-Fi Disconnected", 6),
            (3, "Slow Internet / Packet Drop", 12),
            (4, "Corridor Waste Accumulation", 6),
            (4, "Washroom Sanitization", 4),
            (5, "Classroom Projector Flickering", 8),
            (5, "Audio System / Mic Failure", 4),
        ]
        cur.executemany("INSERT INTO categories (department_id, category_name, target_hours) VALUES (?, ?, ?);", cats)

        # Seed sample complaints
        t1_c = (datetime.now() - timedelta(days=3)).strftime("%Y-%m-%d %H:%M:%S")
        t1_r = (datetime.now() - timedelta(days=2, hours=20)).strftime("%Y-%m-%d %H:%M:%S")
        cur.execute("INSERT INTO complaints (reporter_id, category_id, title, description, location_text, priority, status, created_at, resolved_at) VALUES (1, 5, 'Water leaking in the hostel bathroom', 'Constant water leaking from overhead flush pipe in 3rd floor washroom.', 'Hostel Block B, Room 304 Washroom', 'HIGH', 'RESOLVED', ?, ?);", (t1_c, t1_r))
        c1 = cur.lastrowid
        cur.execute("INSERT INTO assignments (complaint_id, staff_id, assigned_by, assigned_at, ended_at) VALUES (?, 5, 8, ?, ?);", (c1, t1_c, t1_r))
        cur.execute("INSERT INTO status_history (complaint_id, changed_by, old_status, new_status, changed_at, remarks) VALUES (?, 1, NULL, 'SUBMITTED', ?, 'Filed');", (c1, t1_c))
        cur.execute("INSERT INTO feedback (complaint_id, rating, comment, created_at) VALUES (?, 5, 'Fixed promptly.', ?);", (c1, t1_r))

        t2_c = (datetime.now() - timedelta(hours=5)).strftime("%Y-%m-%d %H:%M:%S")
        cur.execute("INSERT INTO complaints (reporter_id, category_id, title, description, location_text, priority, status, created_at) VALUES (2, 7, 'Wi-Fi not working on hostel 4th floor', 'Signal strength is zero and access point AP-H4-02 has amber blinking light.', 'Hostel Block A, 4th Floor Wing B', 'URGENT', 'IN_PROGRESS', ?);", (t2_c,))
        c2 = cur.lastrowid
        cur.execute("INSERT INTO assignments (complaint_id, staff_id, assigned_by, assigned_at) VALUES (?, 6, 8, ?);", (c2, t2_c))

        for cid, txt in [(c1, "Water leaking in the hostel bathroom"), (c2, "Wi-Fi not working on hostel 4th floor")]:
            v = generate_local_embedding(txt)
            cur.execute("INSERT INTO complaint_embeddings (complaint_id, embedding_json, model_name, content_hash) VALUES (?, ?, 'all-MiniLM-L6-v2', 'hash');", (cid, json.dumps(v)))

    conn.commit()
    conn.close()
