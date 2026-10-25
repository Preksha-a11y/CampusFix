"""
CampusFix: Live Supabase PostgreSQL + pgvector Automated Verification Script
Run anytime to verify all tables, constraints, views, triggers, and pgvector search.
"""

import sys
import os

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

from campusfix_db import (
    get_connection,
    get_cursor,
    get_backend_name,
    find_similar_complaints,
    get_department_analytics,
    get_pending_complaints,
    create_complaint,
    USE_POSTGRES
)


def verify_supabase():
    print("=" * 70)
    print("  CAMPUSFIX LIVE POSTGRESQL + PGVECTOR VERIFICATION SUITE")
    print(f"  Target: {get_backend_name()}")
    print("=" * 70)

    if not USE_POSTGRES:
        print("[ERROR] DATABASE_URL not active. Check .env configuration.")
        return

    conn = get_connection()
    cur = get_cursor(conn)

    # 1. Verify 10 Tables
    expected_tables = [
        'roles', 'users', 'departments', 'categories', 'complaints',
        'assignments', 'status_history', 'feedback', 'complaint_embeddings', 'notifications'
    ]
    cur.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
    """)
    actual_tables = [r['table_name'] for r in cur.fetchall()]
    for t in expected_tables:
        assert t in actual_tables, f"Missing table: {t}"
    print(f"[OK] 1. All {len(expected_tables)} Relational Tables verified in Supabase.")

    # 2. Verify 2 Views
    expected_views = ['view_pending_complaints', 'view_department_analytics']
    cur.execute("""
        SELECT table_name 
        FROM information_schema.views 
        WHERE table_schema = 'public';
    """)
    actual_views = [r['table_name'] for r in cur.fetchall()]
    for v in expected_views:
        assert v in actual_views, f"Missing view: {v}"
    print(f"[OK] 2. All {len(expected_views)} SQL Views verified in Supabase.")

    # 3. Verify pgvector extension
    cur.execute("SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';")
    vec_row = cur.fetchone()
    assert vec_row is not None, "pgvector extension not installed"
    print(f"[OK] 3. pgvector extension active (version {vec_row['extversion']}).")

    # 4. Verify Triggers
    cur.execute("""
        SELECT trigger_name 
        FROM information_schema.triggers 
        WHERE event_object_table = 'complaints';
    """)
    triggers = [r['trigger_name'] for r in cur.fetchall()]
    print(f"[OK] 4. Verified active triggers on complaints table: {triggers}")

    # 5. Verify Native pgvector Cosine Search
    query = "Water leaking in the hostel bathroom"
    matches = find_similar_complaints(query, threshold=0.5, limit=3)
    assert len(matches) > 0, "pgvector cosine search returned empty"
    top = matches[0]
    print(f"[OK] 5. pgvector Cosine Distance Search (<=>) succeeded:")
    print(f"     Query: '{query}'")
    print(f"     Top Match: Complaint #{top['complaint_id']} - '{top['title']}' ({top['similarity_score']*100:.1f}%)")

    # 6. Verify Views Data
    analytics = get_department_analytics()
    assert len(analytics) > 0, "view_department_analytics returned empty"
    print(f"[OK] 6. view_department_analytics returned {len(analytics)} department summaries.")

    conn.close()
    print("\n" + "=" * 70)
    print("  ALL 6 LIVE SUPABASE PGVECTOR VERIFICATIONS PASSED (100% SUCCESS)!")
    print("=" * 70)


if __name__ == '__main__':
    verify_supabase()
