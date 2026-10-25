# CampusFix: Intelligent Campus Complaint Management and Resolution System

**DBMS Experiential Learning – Level 3 MiniProject**  
**Department of Computer Science and Engineering, PES University**

---

## 1. Project Overview & Problem Statement
* **Project Title**: CampusFix: Intelligent Campus Complaint Management and Resolution System
* **Domain**: Campus Infrastructure & Facility Maintenance Management
* **Problem Statement**:
  Students and faculty submit daily maintenance complaints concerning electricity, plumbing, Wi-Fi connectivity, classrooms, cleanliness, and hostel amenities. Without a centralized and intelligent system, complaints often get duplicated, misrouted to incorrect departments, or resolved without SLA tracking or verifiable accountability.
* **Core Solution**:
  CampusFix provides an end-to-end complaint tracking lifecycle integrated with:
  1. Automated department and category assignment with Service Level Agreement (SLA) turnaround hours.
  2. Dense vector embeddings and semantic similarity search to detect and prevent duplicate complaints before submission.
  3. Role-based workflow (Reporter, Maintenance Staff, Administrator).
  4. Real-time departmental analytics dashboards (pending issues, average resolution hours, user satisfaction ratings).
  5. Audit trails and escalation triggers for SLA breaches.

---

## 2. Technology Justification & Architecture
| Paradigm | Database / Technology | Justification |
| :--- | :--- | :--- |
| **SQL Database (Relational)** | **PostgreSQL / SQLite** | High transactional integrity (ACID), strict foreign keys, check constraints, automatic audit triggers, views, and complex analytical aggregations. |
| **Vector Database / Semantic Search** | **pgvector (384-d Cosine Similarity)** | Enables natural language similarity search across complaint descriptions (e.g. mapping *"water dripping in washroom"* to *"pipe leaking in bathroom"*), preventing duplicate work orders. |
| **NoSQL Database (Document)** | **MongoDB (`complaint_documents`)** | Stores unstructured complaint attachments (image URLs, EXIF metadata, dynamic device telemetry, and NLP-extracted keyword arrays). |

---

## 3. Relational Schema & Constraints
Aligned with the project ER diagram and relational models in `CampusFix_Chen_ER_Diagram.drawio` and `CampusFix_Database_Design.drawio`:

1. **`roles`** (`role_id` [PK], `role_name` [UQ, NN, CHECK: `REPORTER`, `STAFF`, `ADMIN`])
2. **`users`** (`user_id` [PK], `role_id` [FK], `full_name`, `email` [UQ], `password_hash`, `is_active`, `created_at`)
3. **`departments`** (`department_id` [PK], `department_name` [UQ, nonblank])
4. **`categories`** (`category_id` [PK], `department_id` [FK], `category_name`, `target_hours` [CHECK > 0], `UNIQUE(department_id, category_name)`)
5. **`complaints`** (`complaint_id` [PK], `reporter_id` [FK], `category_id` [FK], `title`, `description`, `location_text`, `priority` [CHECK: `LOW`, `MEDIUM`, `HIGH`, `URGENT`], `status` [CHECK: `SUBMITTED`, `ASSIGNED`, `IN_PROGRESS`, `RESOLVED`, `REJECTED`], `created_at`, `resolved_at`)
6. **`assignments`** (`assignment_id` [PK], `complaint_id` [FK], `staff_id` [FK], `assigned_by` [FK], `assigned_at`, `ended_at`, Unique active assignment index)
7. **`status_history`** (`history_id` [PK], `complaint_id` [FK], `changed_by` [FK], `old_status`, `new_status`, `changed_at`, `remarks`)
8. **`feedback`** (`complaint_id` [PK, FK], `rating` [CHECK 1..5], `comment`, `created_at`)
9. **`complaint_embeddings`** (`complaint_id` [PK, FK], `embedding` [384-d vector], `model_name`, `content_hash`, `updated_at`)
10. **`notifications`** (`notification_id` [PK], `user_id` [FK], `complaint_id` [FK], `message`, `is_read`, `created_at`)

---

## 4. Advanced Database Concepts Implemented

### 4.1 ACID Transactions
- **Atomic Complaint Submission**: Atomically inserts into `complaints`, registers the initial `status_history` entry, generates vector embeddings, and creates admin notifications within a single rollback-safe transaction.
- **Atomic Staff Reassignment**: Closes previous open assignment (`ended_at = CURRENT_TIMESTAMP`) and opens a new assignment in a single transaction.

### 4.2 Database Triggers
- **`trg_complaint_resolve`**: Automatically stamps `resolved_at = CURRENT_TIMESTAMP` whenever status transitions to `'RESOLVED'`.
- **`trg_complaint_reopen`**: Resets `resolved_at = NULL` if a resolved ticket is reopened.
- **`trg_complaint_status_history`**: Automatically records state transitions in `status_history` audit table.

### 4.3 Database Views
- **`view_pending_complaints`**: Joins open complaints with category SLA, department, reporter, and assigned technician details. Computes open duration in hours and flags `is_overdue`.
- **`view_department_analytics`**: Aggregates total complaints, pending count, resolved count, average resolution turnaround time, and average user satisfaction rating per department.

### 4.4 Stored Procedures / Functions
- **`fn_calculate_avg_resolution_hours(p_dept_id)`**: Calculates average resolution time (in hours) for any given department.
- **`sp_create_complaint` & `sp_assign_staff`**: Transactional procedures for complaint lifecycle management.

### 4.5 Indexing Strategy
- B-Tree indexes on foreign keys and filter columns: `complaints(status)`, `complaints(category_id)`, `complaints(reporter_id)`, `assignments(complaint_id)`.
- Cosine Distance HNSW index (`embedding vector_cosine_ops`) for sub-millisecond semantic search.

---

## 5. File Structure
```text
DBMS-lvl3-proj/
â”œâ”€â”€ CampusFix_Chen_ER_Diagram.drawio      # Chen notation ER Diagram
â”œâ”€â”€ CampusFix_Database_Design.drawio      # Crow's foot ER & Relational Schema
â”œâ”€â”€ CampusFix_Syllabus_Aligned.drawio     # Syllabus aligned ER & Relational models
â”œâ”€â”€ postgres_schema.sql                   # Production PostgreSQL + pgvector DDL, triggers & views
â”œâ”€â”€ mongodb_schema.js                     # MongoDB NoSQL collection validator, indexes & aggregations
â”œâ”€â”€ queries.sql                            # DDL, DML, Joins, Nested/Correlated Subqueries, CTEs
â”œâ”€â”€ campusfix_db.py                       # Python DB engine, seed data & vector similarity module
â”œâ”€â”€ cli_app.py                            # Interactive Terminal Interface (Role-based CLI)
â”œâ”€â”€ verify_db.py                          # Automated verification and grading test suite
â””â”€â”€ README.md                             # Project documentation and evaluation guide
```

---

## 6. How to Run the Verification & Terminal Interface

### 6.1 Run Automated Verification Suite
Verifies all 10 tables, check constraints, foreign keys, triggers, views, transactions, vector search, and advanced SQL queries:
```bash
python verify_db.py
```

### 6.2 Launch Interactive Terminal Interface
Run the interactive terminal app:
```bash
python cli_app.py
```
Or run the non-interactive demo:
```bash
python cli_app.py --demo
```

---

## 7. Interactive Terminal Features
1. **Student / Faculty (Reporter)**:
   - Submit new complaints with **instant duplicate detection warning**.
   - View my submitted complaints and track their live status.
   - View timestamped status audit trail with technician notes.
   - Submit 1 to 5 star ratings and feedback for resolved complaints.
2. **Maintenance Staff**:
   - View assigned work orders.
   - Update complaint status (`IN_PROGRESS`, `RESOLVED`, `REJECTED`) with remarks.
3. **Campus Administrator**:
   - View all complaints across all departments.
   - Assign / reassign complaints to technicians.
   - Monitor overdue complaints exceeding SLA target hours.
   - View Department Performance Dashboard.
4. **Intelligent Vector Search**:
   - Natural language semantic similarity search (e.g. *"water leaking in hostel bathroom"*).
5. **Level 3 Syllabus Query Runner**:
   - Directly executes and displays formatted results for 5-Table JOINs, Correlated Subqueries, Aggregates with HAVING, and CTEs with Window Functions.
