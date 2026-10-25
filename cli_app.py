"""
CampusFix: Intelligent Campus Complaint Management and Resolution System
Interactive Terminal / Command-Line Interface (cli_app.py)

Exposes a raw/terminal interface showcasing the complete DBMS workflow:
- Role-based interaction: Reporter (Student/Faculty), Maintenance Staff, Admin
- Detailed Complaint View (Full Description, Location, Timeline, Feedback)
- Real-time Semantic Duplicate Detection (Calibrated Cosine Similarity)
- Technician Assignment & Progress Updates (Triggering Audit History)
- Feedback & Rating submission and updates
- Department Analytics Dashboard (Views & Aggregations)
- Live connection to Supabase PostgreSQL 17 + pgvector
"""

import sys
import os

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

from campusfix_db import (
    get_connection,
    get_cursor,
    get_backend_name,
    init_database,
    create_complaint,
    find_similar_complaints,
    get_complaint_details,
    assign_staff,
    update_complaint_status,
    submit_feedback,
    get_department_analytics,
    get_pending_complaints,
    USE_POSTGRES
)


def print_header(title):
    print("\n" + "=" * 78)
    print(f"  {title.upper()}")
    print(f"  [Active Database: {get_backend_name()}]")
    print("=" * 78)


def format_table(headers, rows):
    """Simple clean ASCII table printer."""
    if not rows:
        print("  (No records found)")
        return

    col_widths = [len(h) for h in headers]
    for row in rows:
        for i, val in enumerate(row):
            col_widths[i] = max(col_widths[i], len(str(val) if val is not None else "NULL"))

    header_str = " | ".join(h.ljust(col_widths[i]) for i, h in enumerate(headers))
    sep_str = "-+-".join("-" * col_widths[i] for i in range(len(headers)))
    print("  " + header_str)
    print("  " + sep_str)
    for row in rows:
        row_str = " | ".join(str(val if val is not None else "").ljust(col_widths[i]) for i, val in enumerate(row))
        print("  " + row_str)


# ============================================================================
# DETAILED COMPLAINT CARD
# ============================================================================

def view_full_complaint_card(complaint_id):
    details, history = get_complaint_details(complaint_id)
    if not details:
        print(f"\n[Error] Complaint #{complaint_id} not found.")
        return

    print_header(f"Complaint #{details['complaint_id']} Full Details")
    print(f"  Title:        {details['title']}")
    print(f"  Category:     {details['category_name']} (Dept: {details['department_name']})")
    print(f"  Priority:     {details['priority']}")
    print(f"  Status:       {details['status']}")
    print(f"  Location:     {details['location_text']}")
    print(f"  SLA Target:   {details['target_hours']} hours")
    print(f"  Reported By:  {details['reporter_name']} ({details['reporter_email']})")
    print(f"  Created At:   {str(details['created_at'])[:19]}")
    print(f"  Assigned To:  {details['staff_name'] or 'Unassigned'} ({details['staff_email'] or '-'})")
    print(f"  Resolved At:  {str(details['resolved_at'])[:19] if details['resolved_at'] else 'Pending'}")

    print("\n  FULL DESCRIPTION:")
    print(f"  {details['description']}")

    print("\n  USER FEEDBACK:")
    if details['feedback_rating']:
        stars = "*" * details['feedback_rating']
        print(f"  Rating:       {stars} ({details['feedback_rating']} / 5)")
        print(f"  Comment:      {details['feedback_comment'] or '(No comment)'}")
        print(f"  Submitted At: {str(details['feedback_time'])[:19]}")
    else:
        print("  (No feedback submitted yet)")

    print("\n  STATUS AUDIT TRAIL:")
    if history:
        headers = ["Seq", "Old Status", "New Status", "Changed By", "Timestamp", "Remarks"]
        data = [
            [h['history_id'], h['old_status'], h['new_status'], h['changed_by'][:22], str(h['changed_at'])[:19], h['remarks']]
            for h in history
        ]
        format_table(headers, data)
    else:
        print("  (No status history logged)")


# ============================================================================
# REPORTER ACTIONS (STUDENT / FACULTY)
# ============================================================================

def reporter_menu(user):
    while True:
        print_header(f"Reporter Portal: {user['full_name']} ({user['email']})")
        print("  1. Submit New Complaint (with Intelligent Duplicate Check)")
        print("  2. View My Complaints (Summary Table)")
        print("  3. View Full Complaint Details by ID (Full Text, Staff & Feedback)")
        print("  4. View Complaint Status History / Audit Trail")
        print("  5. Submit / Update Feedback for Resolved Complaint")
        print("  6. Search Similar / Duplicate Complaints (Semantic Search)")
        print("  0. Switch Role / Return to Main Menu")

        choice = input("\nEnter choice [0-6]: ").strip()
        if choice == '1':
            submit_complaint_flow(user)
        elif choice == '2':
            view_my_complaints(user)
        elif choice == '3':
            cid_in = input("\nEnter Complaint ID to view full details: ").strip()
            if cid_in.isdigit():
                view_full_complaint_card(int(cid_in))
            else:
                print("Invalid Complaint ID.")
        elif choice == '4':
            view_complaint_history()
        elif choice == '5':
            submit_feedback_flow(user)
        elif choice == '6':
            search_complaints_flow()
        elif choice == '0':
            break
        else:
            print("Invalid choice, please retry.")


def submit_complaint_flow(user):
    print_header("Submit New Complaint")

    conn = get_connection()
    cur = get_cursor(conn)
    cur.execute("""
        SELECT cat.category_id, cat.category_name, cat.target_hours, dept.department_name
        FROM categories cat
        JOIN departments dept ON cat.department_id = dept.department_id
        ORDER BY cat.category_id;
    """)
    categories = cur.fetchall()
    conn.close()

    print("Available Complaint Categories:")
    for cat in categories:
        print(f"  [{cat['category_id']}] {cat['category_name']} ({cat['department_name']} - SLA: {cat['target_hours']}h)")

    cat_id_input = input("\nEnter Category ID: ").strip()
    try:
        cat_id = int(cat_id_input)
    except ValueError:
        print("Invalid category ID.")
        return

    title = input("Complaint Title (e.g. Water tap leaking in washroom): ").strip()
    if not title:
        print("Title cannot be blank.")
        return

    description = input("Detailed Description: ").strip()
    location_text = input("Location (e.g. Hostel Block B, 2nd Floor): ").strip()

    print("Priority Level: 1) LOW  2) MEDIUM  3) HIGH  4) URGENT")
    prio_choice = input("Select Priority [1-4, default=2]: ").strip()
    prio_map = {'1': 'LOW', '2': 'MEDIUM', '3': 'HIGH', '4': 'URGENT'}
    priority = prio_map.get(prio_choice, 'MEDIUM')

    # Intelligent Duplicate Detection with calibrated threshold
    print("\n[AI Vector Engine] Scanning database for similar issues via pgvector embeddings...")
    similar = find_similar_complaints(f"{title} {description}", threshold=0.65, limit=3)
    if similar:
        print("\n" + "!" * 78)
        print("WARNING: Semantically similar complaints have already been reported!")
        print("!" * 78)
        for s in similar:
            print(f"  - Complaint #{s['complaint_id']}: '{s['title']}'")
            print(f"    Status: {s['status']} | Location: {s['location']} | Similarity: {s['similarity_score']*100:.1f}%")
        proceed = input("\nDo you still want to submit a new complaint? (y/n): ").strip().lower()
        if proceed != 'y':
            print("Submission cancelled. You can track the existing complaint instead.")
            return

    new_id = create_complaint(
        reporter_id=user['user_id'],
        category_id=cat_id,
        title=title,
        description=description,
        location_text=location_text,
        priority=priority
    )
    print(f"\n[OK] Complaint #{new_id} successfully created and logged in Supabase!")
    print(f"[OK] Dense vector embedding generated and indexed for duplicate detection.")


def view_my_complaints(user):
    print_header(f"Complaints Reported by {user['full_name']}")
    conn = get_connection()
    cur = get_cursor(conn)
    param = "%s" if USE_POSTGRES else "?"
    cur.execute(f"""
        SELECT 
            c.complaint_id,
            c.title,
            c.priority,
            c.status,
            cat.category_name,
            c.created_at,
            c.resolved_at
        FROM complaints c
        JOIN categories cat ON c.category_id = cat.category_id
        WHERE c.reporter_id = {param}
        ORDER BY c.complaint_id DESC;
    """, (user['user_id'],))
    rows = cur.fetchall()
    conn.close()

    headers = ["ID", "Title", "Priority", "Status", "Category", "Created At", "Resolved At"]
    data = [
        [
            r['complaint_id'],
            r['title'][:32],
            r['priority'],
            r['status'],
            r['category_name'][:22],
            str(r['created_at'])[:16],
            str(r['resolved_at'])[:16] if r['resolved_at'] else "-"
        ]
        for r in rows
    ]
    format_table(headers, data)
    print("\nTip: Choose Option 3 from the menu to inspect the full text and details of any complaint.")


def view_complaint_history():
    cid_input = input("\nEnter Complaint ID to view status audit trail: ").strip()
    try:
        cid = int(cid_input)
    except ValueError:
        print("Invalid ID.")
        return

    conn = get_connection()
    cur = get_cursor(conn)
    param = "%s" if USE_POSTGRES else "?"
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
    """, (cid,))
    rows = cur.fetchall()
    conn.close()

    print_header(f"Status Audit Trail for Complaint #{cid}")
    headers = ["Seq", "Previous Status", "New Status", "Updated By", "Timestamp", "Remarks"]
    data = [
        [r['history_id'], r['old_status'], r['new_status'], r['changed_by'][:22], str(r['changed_at'])[:19], r['remarks']]
        for r in rows
    ]
    format_table(headers, data)


def submit_feedback_flow(user):
    print_header("Submit / Update Resolution Feedback")
    conn = get_connection()
    cur = get_cursor(conn)
    param = "%s" if USE_POSTGRES else "?"
    cur.execute(f"""
        SELECT 
            c.complaint_id, 
            c.title, 
            c.resolved_at,
            f.rating,
            f.comment
        FROM complaints c
        LEFT JOIN feedback f ON c.complaint_id = f.complaint_id
        WHERE c.reporter_id = {param} AND c.status = 'RESOLVED'
        ORDER BY c.complaint_id ASC;
    """, (user['user_id'],))
    resolved_complaints = cur.fetchall()
    conn.close()

    if not resolved_complaints:
        print("No resolved complaints found for your account.")
        return

    print("Your Resolved Complaints:")
    for comp in resolved_complaints:
        if comp['rating']:
            status_text = f"Rated: {comp['rating']}/5 stars (\"{comp['comment'] or ''}\")"
        else:
            status_text = "Not rated yet"
        print(f"  [{comp['complaint_id']}] {comp['title']} (Resolved: {str(comp['resolved_at'])[:16]}) -> {status_text}")

    cid_input = input("\nEnter Complaint ID to submit or update rating: ").strip()
    try:
        cid = int(cid_input)
    except ValueError:
        print("Invalid ID.")
        return

    rating_input = input("Rating (1 to 5 stars): ").strip()
    try:
        rating = int(rating_input)
        if not (1 <= rating <= 5):
            raise ValueError()
    except ValueError:
        print("Rating must be an integer between 1 and 5.")
        return

    comment = input("Feedback Comment: ").strip()
    submit_feedback(cid, rating, comment)
    print(f"\n[OK] Feedback successfully recorded for Complaint #{cid}!")


# ============================================================================
# MAINTENANCE STAFF ACTIONS
# ============================================================================

def staff_menu(user):
    while True:
        print_header(f"Maintenance Staff Portal: {user['full_name']}")
        print("  1. View Complaints Assigned to Me")
        print("  2. View Full Complaint Details by ID")
        print("  3. Update Complaint Progress / Mark Resolved")
        print("  4. View Complaint Status History")
        print("  0. Switch Role / Return to Main Menu")

        choice = input("\nEnter choice [0-4]: ").strip()
        if choice == '1':
            view_assigned_complaints(user)
        elif choice == '2':
            cid_in = input("\nEnter Complaint ID: ").strip()
            if cid_in.isdigit():
                view_full_complaint_card(int(cid_in))
        elif choice == '3':
            update_progress_flow(user)
        elif choice == '4':
            view_complaint_history()
        elif choice == '0':
            break
        else:
            print("Invalid choice, please retry.")


def view_assigned_complaints(user):
    print_header(f"Assigned Complaints for {user['full_name']}")
    conn = get_connection()
    cur = get_cursor(conn)
    param = "%s" if USE_POSTGRES else "?"
    cur.execute(f"""
        SELECT 
            c.complaint_id,
            c.title,
            c.location_text,
            c.priority,
            c.status,
            cat.category_name,
            a.assigned_at
        FROM assignments a
        JOIN complaints c ON a.complaint_id = c.complaint_id
        JOIN categories cat ON c.category_id = cat.category_id
        WHERE a.staff_id = {param} AND a.ended_at IS NULL
        ORDER BY c.complaint_id DESC;
    """, (user['user_id'],))
    rows = cur.fetchall()
    conn.close()

    headers = ["ID", "Title", "Location", "Priority", "Status", "Category", "Assigned At"]
    data = [
        [
            r['complaint_id'],
            r['title'][:25],
            r['location_text'][:25],
            r['priority'],
            r['status'],
            r['category_name'][:20],
            str(r['assigned_at'])[:16]
        ]
        for r in rows
    ]
    format_table(headers, data)


def update_progress_flow(user):
    print_header("Update Complaint Status")
    view_assigned_complaints(user)

    cid_input = input("\nEnter Complaint ID to update: ").strip()
    try:
        cid = int(cid_input)
    except ValueError:
        print("Invalid ID.")
        return

    print("\nSelect New Status:")
    print("  1. IN_PROGRESS")
    print("  2. RESOLVED")
    print("  3. REJECTED")
    st_choice = input("Enter choice [1-3]: ").strip()
    status_map = {'1': 'IN_PROGRESS', '2': 'RESOLVED', '3': 'REJECTED'}
    new_status = status_map.get(st_choice)
    if not new_status:
        print("Invalid status option.")
        return

    remarks = input("Technician Remarks / Action Taken: ").strip()
    update_complaint_status(cid, user['user_id'], new_status, remarks)
    print(f"\n[OK] Complaint #{cid} updated to {new_status}!")
    print(f"[OK] Trigger trg_complaint_status_audit logged transition into status_history.")


# ============================================================================
# ADMINISTRATOR ACTIONS
# ============================================================================

def admin_menu(user):
    while True:
        print_header("Administrator Portal: Campus Estate & Maintenance")
        print("  1. View All Complaints (Summary Table)")
        print("  2. View Full Complaint Details by ID")
        print("  3. Assign / Reassign Complaint to Staff")
        print("  4. View Overdue Complaints Monitor (SLA Tracking)")
        print("  5. View Department Analytics Dashboard")
        print("  6. Run DBMS Level 3 Syllabus Queries (JOINs, Subqueries, CTEs)")
        print("  0. Switch Role / Return to Main Menu")

        choice = input("\nEnter choice [0-6]: ").strip()
        if choice == '1':
            view_all_complaints()
        elif choice == '2':
            cid_in = input("\nEnter Complaint ID: ").strip()
            if cid_in.isdigit():
                view_full_complaint_card(int(cid_in))
        elif choice == '3':
            assign_staff_flow(user)
        elif choice == '4':
            view_overdue_complaints()
        elif choice == '5':
            view_analytics_dashboard()
        elif choice == '6':
            run_syllabus_queries()
        elif choice == '0':
            break
        else:
            print("Invalid choice, please retry.")


def view_all_complaints():
    print_header("All Campus Complaints")
    conn = get_connection()
    cur = get_cursor(conn)
    cur.execute("""
        SELECT 
            c.complaint_id,
            c.title,
            c.priority,
            c.status,
            cat.category_name,
            dept.department_name,
            rep.full_name as reporter,
            COALESCE(staff.full_name, 'Unassigned') as technician
        FROM complaints c
        JOIN categories cat ON c.category_id = cat.category_id
        JOIN departments dept ON cat.department_id = dept.department_id
        JOIN users rep ON c.reporter_id = rep.user_id
        LEFT JOIN assignments a ON c.complaint_id = a.complaint_id AND a.ended_at IS NULL
        LEFT JOIN users staff ON a.staff_id = staff.user_id
        ORDER BY c.complaint_id DESC;
    """)
    rows = cur.fetchall()
    conn.close()

    headers = ["ID", "Title", "Priority", "Status", "Department", "Reporter", "Technician"]
    data = [
        [
            r['complaint_id'],
            r['title'][:22],
            r['priority'],
            r['status'],
            r['department_name'][:20],
            r['reporter'][:15],
            r['technician'][:15]
        ]
        for r in rows
    ]
    format_table(headers, data)


def assign_staff_flow(admin_user):
    print_header("Assign Staff to Complaint")
    view_all_complaints()

    cid_input = input("\nEnter Complaint ID to assign: ").strip()
    try:
        cid = int(cid_input)
    except ValueError:
        print("Invalid ID.")
        return

    conn = get_connection()
    cur = get_cursor(conn)
    cur.execute("""
        SELECT u.user_id, u.full_name, u.email
        FROM users u
        JOIN roles r ON u.role_id = r.role_id
        WHERE r.role_name = 'STAFF' AND u.is_active = TRUE;
    """)
    staff_members = cur.fetchall()
    conn.close()

    print("\nAvailable Maintenance Staff:")
    for s in staff_members:
        print(f"  [{s['user_id']}] {s['full_name']} ({s['email']})")

    sid_input = input("\nEnter Staff ID: ").strip()
    try:
        sid = int(sid_input)
    except ValueError:
        print("Invalid Staff ID.")
        return

    assign_staff(cid, sid, admin_user['user_id'])
    print(f"\n[OK] Complaint #{cid} assigned to staff #{sid} successfully!")


def view_overdue_complaints():
    print_header("Overdue Complaints (SLA Breaches)")
    conn = get_connection()
    cur = get_cursor(conn)
    cur.execute("""
        SELECT 
            complaint_id,
            title,
            department_name,
            category_name,
            target_hours,
            hours_open,
            priority,
            status,
            COALESCE(staff_name, 'Unassigned') as staff
        FROM view_pending_complaints
        WHERE is_overdue = TRUE
        ORDER BY hours_open DESC;
    """)
    rows = cur.fetchall()
    conn.close()

    if not rows:
        print("  [OK] No overdue complaints! All open issues are within expected SLA turnaround.")
        return

    headers = ["ID", "Title", "Department", "Target(h)", "Open(h)", "Priority", "Status", "Staff"]
    data = [
        [
            r['complaint_id'],
            r['title'][:22],
            r['department_name'][:18],
            r['target_hours'],
            r['hours_open'],
            r['priority'],
            r['status'],
            r['staff']
        ]
        for r in rows
    ]
    format_table(headers, data)


def view_analytics_dashboard():
    print_header("Department Performance Analytics Dashboard")
    analytics = get_department_analytics()

    headers = ["Dept ID", "Department Name", "Total", "Pending", "Resolved", "Avg Res Time", "Avg Rating"]
    data = [
        [
            a['department_id'],
            a['department_name'],
            a['total_complaints'],
            a['pending_complaints'],
            a['resolved_complaints'],
            f"{a['avg_resolution_hours']} h" if a.get('avg_resolution_hours') is not None else "N/A",
            f"{a['avg_satisfaction_rating']}/5.0" if a.get('avg_satisfaction_rating') is not None else "N/A"
        ]
        for a in analytics
    ]
    format_table(headers, data)


# ============================================================================
# SEARCH & QUERY RUNNER
# ============================================================================

def search_complaints_flow():
    print_header("Intelligent Vector / Semantic Search (pgvector)")
    query = input("Enter search query (e.g. 'wifi down' or 'water leaking in washroom'): ").strip()
    if not query:
        return

    print(f"\n[AI Vector Engine] Generating 384-d dense embedding & running cosine similarity in PostgreSQL...")
    results = find_similar_complaints(query, threshold=0.15, limit=5)
    if not results:
        print("No matching complaints found.")
        return

    headers = ["ID", "Similarity", "Title", "Category", "Department", "Status"]
    data = [
        [
            r['complaint_id'],
            f"{r['similarity_score']*100:.1f}%",
            r['title'][:28],
            r['category'][:22],
            r['department'][:20],
            r['status']
        ]
        for r in results
    ]
    format_table(headers, data)


def run_syllabus_queries():
    while True:
        print_header("DBMS Level 3 Syllabus Evaluation Queries")
        print("  1. Multi-Table JOIN (5 Tables: Complaints + Categories + Depts + Reporters + Staff)")
        print("  2. Correlated Subquery (Complaints exceeding dept avg resolution)")
        print("  3. Aggregate Query with GROUP BY & HAVING (Department Performance)")
        print("  4. Common Table Expression (CTE) with RANK() Window Function")
        print("  5. Query Predefined View (view_pending_complaints)")
        print("  0. Back to Admin Menu")

        choice = input("\nSelect Query to execute [0-5]: ").strip()
        conn = get_connection()
        cur = get_cursor(conn)

        if choice == '1':
            print_header("Query 1: 5-Table JOIN Audit")
            sql = """
                SELECT 
                    c.complaint_id, c.title, c.status,
                    dept.department_name, cat.category_name,
                    u.full_name AS reporter,
                    COALESCE(s.full_name, 'None') AS staff
                FROM complaints c
                JOIN categories cat ON c.category_id = cat.category_id
                JOIN departments dept ON cat.department_id = dept.department_id
                JOIN users u ON c.reporter_id = u.user_id
                LEFT JOIN assignments a ON c.complaint_id = a.complaint_id AND a.ended_at IS NULL
                LEFT JOIN users s ON a.staff_id = s.user_id
                LIMIT 5;
            """
            cur.execute(sql)
            rows = cur.fetchall()
            headers = ["ID", "Title", "Status", "Department", "Category", "Reporter", "Staff"]
            data = [[r['complaint_id'], r['title'][:20], r['status'], r['department_name'][:18], r['category_name'][:18], r['reporter'][:14], r['staff'][:14]] for r in rows]
            format_table(headers, data)

        elif choice == '2':
            print_header("Query 2: Correlated Subquery")
            if USE_POSTGRES:
                sql = """
                    SELECT c.complaint_id, c.title, dept.department_name
                    FROM complaints c
                    JOIN categories cat ON c.category_id = cat.category_id
                    JOIN departments dept ON cat.department_id = dept.department_id
                    WHERE c.status = 'RESOLVED'
                      AND EXTRACT(EPOCH FROM (c.resolved_at - c.created_at)) / 3600.0 >= (
                          SELECT AVG(EXTRACT(EPOCH FROM (c2.resolved_at - c2.created_at)) / 3600.0)
                          FROM complaints c2
                          JOIN categories cat2 ON c2.category_id = cat2.category_id
                          WHERE cat2.department_id = dept.department_id AND c2.status = 'RESOLVED'
                      );
                """
            else:
                sql = """
                    SELECT c.complaint_id, c.title, dept.department_name
                    FROM complaints c
                    JOIN categories cat ON c.category_id = cat.category_id
                    JOIN departments dept ON cat.department_id = dept.department_id
                    WHERE c.status = 'RESOLVED'
                      AND (julianday(c.resolved_at) - julianday(c.created_at)) >= (
                          SELECT AVG(julianday(c2.resolved_at) - julianday(c2.created_at))
                          FROM complaints c2
                          JOIN categories cat2 ON c2.category_id = cat2.category_id
                          WHERE cat2.department_id = dept.department_id AND c2.status = 'RESOLVED'
                      );
                """
            cur.execute(sql)
            rows = cur.fetchall()
            headers = ["ID", "Title", "Department"]
            data = [[r['complaint_id'], r['title'][:30], r['department_name']] for r in rows]
            format_table(headers, data)

        elif choice == '3':
            print_header("Query 3: GROUP BY & HAVING Aggregates")
            sql = """
                SELECT 
                    dept.department_name,
                    COUNT(c.complaint_id) as total_logged,
                    COUNT(CASE WHEN c.status NOT IN ('RESOLVED', 'REJECTED') THEN 1 END) as pending,
                    COUNT(CASE WHEN c.status = 'RESOLVED' THEN 1 END) as resolved
                FROM departments dept
                JOIN categories cat ON dept.department_id = cat.department_id
                JOIN complaints c ON cat.category_id = c.category_id
                GROUP BY dept.department_id, dept.department_name
                HAVING COUNT(c.complaint_id) > 0;
            """
            cur.execute(sql)
            rows = cur.fetchall()
            headers = ["Department", "Total Logged", "Pending", "Resolved"]
            data = [[r['department_name'], r['total_logged'], r['pending'], r['resolved']] for r in rows]
            format_table(headers, data)

        elif choice == '4':
            print_header("Query 4: CTE with Window Function RANK()")
            if USE_POSTGRES:
                sql = """
                    WITH DeptDurations AS (
                        SELECT 
                            c.complaint_id,
                            c.title,
                            dept.department_name,
                            ROUND((EXTRACT(EPOCH FROM (COALESCE(c.resolved_at, CURRENT_TIMESTAMP) - c.created_at)) / 3600.0)::numeric, 1) as hrs
                        FROM complaints c
                        JOIN categories cat ON c.category_id = cat.category_id
                        JOIN departments dept ON cat.department_id = dept.department_id
                    )
                    SELECT 
                        department_name,
                        complaint_id,
                        title,
                        hrs,
                        RANK() OVER (PARTITION BY department_name ORDER BY hrs DESC) as rank_in_dept
                    FROM DeptDurations;
                """
            else:
                sql = """
                    WITH DeptDurations AS (
                        SELECT 
                            c.complaint_id,
                            c.title,
                            dept.department_name,
                            ROUND((julianday(COALESCE(c.resolved_at, datetime('now', 'localtime'))) - julianday(c.created_at)) * 24.0, 1) as hrs
                        FROM complaints c
                        JOIN categories cat ON c.category_id = cat.category_id
                        JOIN departments dept ON cat.department_id = dept.department_id
                    )
                    SELECT 
                        department_name,
                        complaint_id,
                        title,
                        hrs,
                        RANK() OVER (PARTITION BY department_name ORDER BY hrs DESC) as rank_in_dept
                    FROM DeptDurations;
                """
            cur.execute(sql)
            rows = cur.fetchall()
            headers = ["Department", "ID", "Title", "Hours Open", "Rank In Dept"]
            data = [[r['department_name'][:20], r['complaint_id'], r['title'][:25], r['hrs'], r['rank_in_dept']] for r in rows]
            format_table(headers, data)

        elif choice == '5':
            print_header("Query 5: Predefined View view_pending_complaints")
            cur.execute("SELECT complaint_id, title, department_name, priority, status, hours_open, is_overdue FROM view_pending_complaints;")
            rows = cur.fetchall()
            headers = ["ID", "Title", "Department", "Priority", "Status", "Hours Open", "Overdue?"]
            data = [[r['complaint_id'], r['title'][:22], r['department_name'][:18], r['priority'], r['status'], r['hours_open'], 'YES' if r['is_overdue'] else 'NO'] for r in rows]
            format_table(headers, data)

        elif choice == '0':
            conn.close()
            break

        conn.close()


# ============================================================================
# MAIN ENTRYPOINT
# ============================================================================

def main():
    init_database()

    if len(sys.argv) > 1 and sys.argv[1] == '--demo':
        print(f"\n[CampusFix CLI] Running automated demo on: {get_backend_name()}...")
        view_analytics_dashboard()
        view_all_complaints()
        view_overdue_complaints()
        print("\n[CampusFix CLI] Running Vector Semantic Search for: 'Water leaking in the hostel bathroom'")
        results = find_similar_complaints("Water leaking in the hostel bathroom", threshold=0.2)
        for r in results:
            print(f"  -> Match #{r['complaint_id']}: {r['title']} ({r['similarity_score']*100:.1f}%)")
        print("\n[CampusFix CLI] Automated demo finished successfully.")
        return

    while True:
        print_header("CampusFix: Campus Complaint Management System")
        print("Select User Profile / Role to log in:")
        print("  1. Student / Reporter (Aarav Sharma)")
        print("  2. Maintenance Staff (Suresh Patel - Plumber)")
        print("  3. Maintenance Staff (Anand V - Network Admin)")
        print("  4. Campus Administrator (Estate & Facilities Admin)")
        print("  5. Quick Vector Search / Duplicate Detector")
        print("  6. View Department Analytics Dashboard")
        print("  0. Exit")

        choice = input("\nEnter choice [0-6]: ").strip()
        conn = get_connection()
        cur = get_cursor(conn)
        param = "%s" if USE_POSTGRES else "?"

        if choice == '1':
            cur.execute(f"SELECT * FROM users WHERE email = {param};", ('aarav.sharma@pes.edu',))
            user = dict(cur.fetchone())
            conn.close()
            reporter_menu(user)
        elif choice == '2':
            cur.execute(f"SELECT * FROM users WHERE email = {param};", ('suresh.plumber@pes.edu',))
            user = dict(cur.fetchone())
            conn.close()
            staff_menu(user)
        elif choice == '3':
            cur.execute(f"SELECT * FROM users WHERE email = {param};", ('anand.network@pes.edu',))
            user = dict(cur.fetchone())
            conn.close()
            staff_menu(user)
        elif choice == '4':
            cur.execute(f"SELECT * FROM users WHERE email = {param};", ('admin.campusfix@pes.edu',))
            user = dict(cur.fetchone())
            conn.close()
            admin_menu(user)
        elif choice == '5':
            conn.close()
            search_complaints_flow()
        elif choice == '6':
            conn.close()
            view_analytics_dashboard()
        elif choice == '0':
            conn.close()
            print("\nExiting CampusFix. Goodbye!")
            break
        else:
            conn.close()
            print("Invalid choice, please select between 0 and 6.")


if __name__ == '__main__':
    main()
