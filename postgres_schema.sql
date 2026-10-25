-- ============================================================================
-- CampusFix: Intelligent Campus Complaint Management and Resolution System
-- PostgreSQL + pgvector Production Schema
-- Designed for DBMS Level 3 Experiential Learning Project
-- Aligned with Chen ER Diagram and Relational Schema (.drawio)
-- ============================================================================

-- 0. Enable Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector"; -- pgvector for semantic search & duplicate detection

-- Drop existing objects for clean setup (if needed)
DROP VIEW IF EXISTS view_department_analytics CASCADE;
DROP VIEW IF EXISTS view_pending_complaints CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS complaint_embeddings CASCADE;
DROP TABLE IF EXISTS feedback CASCADE;
DROP TABLE IF EXISTS status_history CASCADE;
DROP TABLE IF EXISTS assignments CASCADE;
DROP TABLE IF EXISTS complaints CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS departments CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS roles CASCADE;

-- ============================================================================
-- 1. DDL: RELATIONAL TABLES WITH CONSTRAINTS
-- ============================================================================

-- 1.1 ROLES
CREATE TABLE roles (
    role_id SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    role_name VARCHAR(20) NOT NULL UNIQUE,
    CONSTRAINT chk_roles_name CHECK (role_name IN ('REPORTER', 'STAFF', 'ADMIN'))
);

-- 1.2 USERS
CREATE TABLE users (
    user_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    role_id SMALLINT NOT NULL REFERENCES roles(role_id) ON DELETE RESTRICT,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(254) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_user_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- 1.3 DEPARTMENTS
CREATE TABLE departments (
    department_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    department_name VARCHAR(100) NOT NULL UNIQUE,
    CONSTRAINT chk_dept_name_nonblank CHECK (length(trim(department_name)) > 0)
);

-- 1.4 CATEGORIES
CREATE TABLE categories (
    category_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    department_id BIGINT NOT NULL REFERENCES departments(department_id) ON DELETE RESTRICT,
    category_name VARCHAR(100) NOT NULL,
    target_hours INTEGER NOT NULL,
    CONSTRAINT uq_dept_category UNIQUE (department_id, category_name),
    CONSTRAINT chk_target_hours_positive CHECK (target_hours > 0)
);

-- 1.5 COMPLAINTS
CREATE TABLE complaints (
    complaint_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    reporter_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    category_id BIGINT NOT NULL REFERENCES categories(category_id) ON DELETE RESTRICT,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    location_text VARCHAR(200) NOT NULL,
    priority VARCHAR(10) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'SUBMITTED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMPTZ NULL,
    CONSTRAINT chk_complaint_priority CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
    CONSTRAINT chk_complaint_status CHECK (status IN ('SUBMITTED', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'REJECTED')),
    CONSTRAINT chk_complaint_resolution_time CHECK (resolved_at IS NULL OR resolved_at >= created_at),
    CONSTRAINT chk_complaint_resolved_consistency CHECK (
        (status = 'RESOLVED' AND resolved_at IS NOT NULL) OR 
        (status <> 'RESOLVED' AND resolved_at IS NULL)
    )
);

-- 1.6 ASSIGNMENTS
CREATE TABLE assignments (
    assignment_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    complaint_id BIGINT NOT NULL REFERENCES complaints(complaint_id) ON DELETE CASCADE,
    staff_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    assigned_by BIGINT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMPTZ NULL,
    CONSTRAINT chk_assignment_time CHECK (ended_at IS NULL OR ended_at >= assigned_at)
);

-- Unique index to guarantee at most one active (open) assignment per complaint
CREATE UNIQUE INDEX idx_unique_active_assignment 
ON assignments (complaint_id) 
WHERE ended_at IS NULL;

-- 1.7 STATUS_HISTORY (Audit Log)
CREATE TABLE status_history (
    history_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    complaint_id BIGINT NOT NULL REFERENCES complaints(complaint_id) ON DELETE CASCADE,
    changed_by BIGINT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    old_status VARCHAR(20) NULL,
    new_status VARCHAR(20) NOT NULL,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    remarks TEXT NULL,
    CONSTRAINT chk_history_status CHECK (new_status IN ('SUBMITTED', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'))
);

-- 1.8 FEEDBACK (1-to-0..1 relationship with COMPLAINTS)
CREATE TABLE feedback (
    complaint_id BIGINT PRIMARY KEY REFERENCES complaints(complaint_id) ON DELETE CASCADE,
    rating SMALLINT NOT NULL,
    comment TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_feedback_rating CHECK (rating BETWEEN 1 AND 5)
);

-- 1.9 COMPLAINT_EMBEDDINGS (Vector Semantic Search & Duplicate Detection)
CREATE TABLE complaint_embeddings (
    complaint_id BIGINT PRIMARY KEY REFERENCES complaints(complaint_id) ON DELETE CASCADE,
    embedding vector(384) NOT NULL, -- 384-dimensional dense vector (e.g. all-MiniLM-L6-v2)
    model_name VARCHAR(150) NOT NULL,
    content_hash CHAR(64) NOT NULL, -- SHA-256 hash to detect text modification
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 1.10 NOTIFICATIONS
CREATE TABLE notifications (
    notification_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    complaint_id BIGINT NULL REFERENCES complaints(complaint_id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 2. INDEXES FOR PERFORMANCE OPTIMIZATION
-- ============================================================================

-- B-Tree Indexes on Foreign Keys and High-Frequency Filtering Fields
CREATE INDEX idx_complaints_reporter ON complaints(reporter_id);
CREATE INDEX idx_complaints_category ON complaints(category_id);
CREATE INDEX idx_complaints_status ON complaints(status);
CREATE INDEX idx_complaints_priority ON complaints(priority);
CREATE INDEX idx_complaints_created_at ON complaints(created_at DESC);

CREATE INDEX idx_assignments_complaint ON assignments(complaint_id);
CREATE INDEX idx_assignments_staff ON assignments(staff_id);

CREATE INDEX idx_status_history_complaint ON status_history(complaint_id);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id) WHERE is_read = FALSE;

-- Cosine Distance HNSW Index for Fast Vector Similarity Search
CREATE INDEX idx_complaint_embeddings_hnsw 
ON complaint_embeddings 
USING hnsw (embedding vector_cosine_ops);

-- ============================================================================
-- 3. VIEWS FOR DASHBOARDS AND REPORTING
-- ============================================================================

-- 3.1 Pending Complaints with Department & Assigned Staff Details
CREATE OR REPLACE VIEW view_pending_complaints AS
SELECT 
    c.complaint_id,
    c.title,
    c.description,
    c.location_text,
    c.priority,
    c.status,
    c.created_at,
    cat.category_name,
    cat.target_hours,
    dept.department_id,
    dept.department_name,
    rep.user_id AS reporter_id,
    rep.full_name AS reporter_name,
    rep.email AS reporter_email,
    staff.user_id AS staff_id,
    staff.full_name AS staff_name,
    a.assigned_at,
    ROUND(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - c.created_at)) / 3600.0, 2) AS hours_open,
    CASE 
        WHEN EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - c.created_at)) / 3600.0 > cat.target_hours 
        THEN TRUE 
        ELSE FALSE 
    END AS is_overdue
FROM complaints c
JOIN categories cat ON c.category_id = cat.category_id
JOIN departments dept ON cat.department_id = dept.department_id
JOIN users rep ON c.reporter_id = rep.user_id
LEFT JOIN assignments a ON c.complaint_id = a.complaint_id AND a.ended_at IS NULL
LEFT JOIN users staff ON a.staff_id = staff.user_id
WHERE c.status NOT IN ('RESOLVED', 'REJECTED');

-- 3.2 Department-wise Resolution Analytics View
CREATE OR REPLACE VIEW view_department_analytics AS
SELECT 
    d.department_id,
    d.department_name,
    COUNT(c.complaint_id) AS total_complaints,
    COUNT(CASE WHEN c.status IN ('SUBMITTED', 'ASSIGNED', 'IN_PROGRESS') THEN 1 END) AS pending_complaints,
    COUNT(CASE WHEN c.status = 'RESOLVED' THEN 1 END) AS resolved_complaints,
    COUNT(CASE WHEN c.status = 'REJECTED' THEN 1 END) AS rejected_complaints,
    ROUND(
        AVG(CASE 
            WHEN c.status = 'RESOLVED' 
            THEN EXTRACT(EPOCH FROM (c.resolved_at - c.created_at)) / 3600.0 
        END)::numeric, 
        2
    ) AS avg_resolution_hours,
    ROUND(AVG(f.rating)::numeric, 2) AS avg_satisfaction_rating
FROM departments d
LEFT JOIN categories cat ON d.department_id = cat.department_id
LEFT JOIN complaints c ON cat.category_id = c.category_id
LEFT JOIN feedback f ON c.complaint_id = f.complaint_id
GROUP BY d.department_id, d.department_name;

-- ============================================================================
-- 4. STORED PROCEDURES & FUNCTIONS
-- ============================================================================

-- 4.1 Stored Function: Calculate Average Resolution Time (in Hours) for a Department
CREATE OR REPLACE FUNCTION fn_calculate_avg_resolution_hours(p_dept_id BIGINT)
RETURNS NUMERIC AS $$
DECLARE
    v_avg_hours NUMERIC;
BEGIN
    SELECT ROUND(AVG(EXTRACT(EPOCH FROM (c.resolved_at - c.created_at)) / 3600.0)::numeric, 2)
    INTO v_avg_hours
    FROM complaints c
    JOIN categories cat ON c.category_id = cat.category_id
    WHERE cat.department_id = p_dept_id
      AND c.status = 'RESOLVED';

    RETURN COALESCE(v_avg_hours, 0.0);
END;
$$ LANGUAGE plpgsql;

-- 4.2 Stored Procedure: Atomic Complaint Creation with Initial Status History
CREATE OR REPLACE PROCEDURE sp_create_complaint(
    p_reporter_id BIGINT,
    p_category_id BIGINT,
    p_title VARCHAR(200),
    p_description TEXT,
    p_location_text VARCHAR(200),
    p_priority VARCHAR(10),
    INOUT p_complaint_id BIGINT DEFAULT NULL
)
LANGUAGE plpgsql AS $$
BEGIN
    -- 1. Insert Complaint
    INSERT INTO complaints (reporter_id, category_id, title, description, location_text, priority, status)
    VALUES (p_reporter_id, p_category_id, p_title, p_description, p_location_text, p_priority, 'SUBMITTED')
    RETURNING complaint_id INTO p_complaint_id;

    -- 2. Insert Initial Status History
    INSERT INTO status_history (complaint_id, changed_by, old_status, new_status, remarks)
    VALUES (p_complaint_id, p_reporter_id, NULL, 'SUBMITTED', 'Complaint submitted by reporter');

    -- 3. Notify Admins
    INSERT INTO notifications (user_id, complaint_id, message)
    SELECT u.user_id, p_complaint_id, 'New complaint #' || p_complaint_id || ' submitted: ' || p_title
    FROM users u
    JOIN roles r ON u.role_id = r.role_id
    WHERE r.role_name = 'ADMIN';
END;
$$;

-- 4.3 Stored Procedure: Transactional Staff Assignment / Reassignment
CREATE OR REPLACE PROCEDURE sp_assign_staff(
    p_complaint_id BIGINT,
    p_staff_id BIGINT,
    p_admin_id BIGINT
)
LANGUAGE plpgsql AS $$
BEGIN
    -- End any existing active assignment
    UPDATE assignments
    SET ended_at = CURRENT_TIMESTAMP
    WHERE complaint_id = p_complaint_id AND ended_at IS NULL;

    -- Create new active assignment
    INSERT INTO assignments (complaint_id, staff_id, assigned_by, assigned_at)
    VALUES (p_complaint_id, p_staff_id, p_admin_id, CURRENT_TIMESTAMP);

    -- Update complaint status to ASSIGNED if currently SUBMITTED
    UPDATE complaints
    SET status = 'ASSIGNED'
    WHERE complaint_id = p_complaint_id AND status = 'SUBMITTED';

    -- Notify Assigned Staff
    INSERT INTO notifications (user_id, complaint_id, message)
    VALUES (p_staff_id, p_complaint_id, 'You have been assigned to complaint #' || p_complaint_id);
END;
$$;

-- ============================================================================
-- 5. TRIGGERS
-- ============================================================================

-- 5.1 Trigger Function: Automatically Log Status History and Maintain resolved_at
CREATE OR REPLACE FUNCTION trg_fn_complaint_status_audit()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.status IS DISTINCT FROM NEW.status) THEN
        -- Auto-manage resolved_at timestamp
        IF NEW.status = 'RESOLVED' THEN
            NEW.resolved_at := CURRENT_TIMESTAMP;
        ELSIF OLD.status = 'RESOLVED' AND NEW.status <> 'RESOLVED' THEN
            NEW.resolved_at := NULL;
        END IF;

        -- Record in audit status_history
        INSERT INTO status_history (
            complaint_id, 
            changed_by, 
            old_status, 
            new_status, 
            changed_at, 
            remarks
        ) VALUES (
            NEW.complaint_id, 
            NEW.reporter_id, -- default to reporter if not supplied by application context
            OLD.status, 
            NEW.status, 
            CURRENT_TIMESTAMP, 
            'Status transitioned from ' || OLD.status || ' to ' || NEW.status
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_complaint_status_audit
BEFORE UPDATE OF status ON complaints
FOR EACH ROW
EXECUTE FUNCTION trg_fn_complaint_status_audit();
