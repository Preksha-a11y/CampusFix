import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const typeParam = searchParams.get('type') || searchParams.get('query') || '1';
  const type = typeParam.replace(/^q/, '');

  try {
    if (typeParam === 'staff') {
      const staffRes = await query(`
        SELECT u.user_id, u.full_name, u.email, 'Campus Maintenance Staff' AS specialization
        FROM users u
        JOIN roles r ON u.role_id = r.role_id
        WHERE r.role_name = 'STAFF'
        ORDER BY u.user_id ASC;
      `);
      return NextResponse.json({ success: true, staff: staffRes.rows });
    }

    const startTime = Date.now();
    let sql = '';
    let title = '';
    let description = '';

    if (type === '1') {
      title = '5-Table Relational JOIN Audit Profile';
      description = 'Multi-table INNER and LEFT JOINs across 5 entities (COMPLAINTS, CATEGORIES, DEPARTMENTS, USERS, FEEDBACK)';
      sql = `
        SELECT 
          c.complaint_id,
          c.title,
          c.priority,
          c.status,
          dept.department_name,
          cat.category_name,
          cat.target_hours,
          reporter.full_name AS reported_by,
          COALESCE(staff.full_name, 'Unassigned') AS assigned_technician,
          f.rating AS user_rating
        FROM complaints c
        JOIN categories cat ON c.category_id = cat.category_id
        JOIN departments dept ON cat.department_id = dept.department_id
        JOIN users reporter ON c.reporter_id = reporter.user_id
        LEFT JOIN assignments a ON c.complaint_id = a.complaint_id AND a.ended_at IS NULL
        LEFT JOIN users staff ON a.staff_id = staff.user_id
        LEFT JOIN feedback f ON c.complaint_id = f.complaint_id
        ORDER BY c.complaint_id DESC
        LIMIT 10;
      `;
    } else if (type === '2') {
      title = 'Correlated Subquery: Department SLA Overrun Check';
      description = 'Calculates whether an individual complaint took longer than the dynamically computed average of its specific department';
      sql = `
        SELECT 
          c.complaint_id,
          c.title,
          cat.category_name,
          dept.department_name,
          ROUND((EXTRACT(EPOCH FROM (c.resolved_at - c.created_at)) / 3600.0)::numeric, 2) AS resolution_hours
        FROM complaints c
        JOIN categories cat ON c.category_id = cat.category_id
        JOIN departments dept ON cat.department_id = dept.department_id
        WHERE c.status = 'RESOLVED'
          AND EXTRACT(EPOCH FROM (c.resolved_at - c.created_at)) / 3600.0 >= (
            SELECT AVG(EXTRACT(EPOCH FROM (c2.resolved_at - c2.created_at)) / 3600.0)
            FROM complaints c2
            JOIN categories cat2 ON c2.category_id = cat2.category_id
            WHERE cat2.department_id = dept.department_id
              AND c2.status = 'RESOLVED'
          );
      `;
    } else if (type === '3') {
      title = 'Aggregate Functions with GROUP BY & HAVING';
      description = 'Multi-aggregate summarization (COUNT, AVG, Conditional aggregations) with HAVING filter';
      sql = `
        SELECT 
          dept.department_name,
          COUNT(c.complaint_id) AS total_logged,
          COUNT(CASE WHEN c.status NOT IN ('RESOLVED', 'REJECTED') THEN 1 END) AS pending_count,
          COUNT(CASE WHEN c.status = 'RESOLVED' THEN 1 END) AS resolved_count,
          ROUND(AVG(f.rating)::numeric, 2) AS avg_rating,
          ROUND(AVG(EXTRACT(EPOCH FROM (c.resolved_at - c.created_at)) / 3600.0)::numeric, 2) AS avg_turnaround_hrs
        FROM departments dept
        JOIN categories cat ON dept.department_id = cat.department_id
        JOIN complaints c ON cat.category_id = c.category_id
        LEFT JOIN feedback f ON c.complaint_id = f.complaint_id
        GROUP BY dept.department_id, dept.department_name
        HAVING COUNT(c.complaint_id) > 0
        ORDER BY pending_count DESC;
      `;
    } else if (type === '4') {
      title = 'Common Table Expression (CTE) with RANK() Window Function';
      description = 'WITH clause CTE partitioning complaints by department and ranking them by turnaround time';
      sql = `
        WITH ComplaintDurations AS (
          SELECT 
            c.complaint_id,
            c.title,
            dept.department_name,
            cat.category_name,
            cat.target_hours,
            ROUND((EXTRACT(EPOCH FROM (COALESCE(c.resolved_at, CURRENT_TIMESTAMP) - c.created_at)) / 3600.0)::numeric, 1) AS elapsed_hours
          FROM complaints c
          JOIN categories cat ON c.category_id = cat.category_id
          JOIN departments dept ON cat.department_id = dept.department_id
        )
        SELECT 
          department_name,
          complaint_id,
          title,
          category_name,
          target_hours,
          elapsed_hours,
          RANK() OVER (PARTITION BY department_name ORDER BY elapsed_hours DESC) AS rank_in_department
        FROM ComplaintDurations
        ORDER BY department_name, rank_in_department;
      `;
    } else {
      return NextResponse.json({ error: 'Invalid query type' }, { status: 400 });
    }

    const res = await query(sql);
    const executionTimeMs = Date.now() - startTime;
    const columns = res.rows.length > 0 ? Object.keys(res.rows[0]) : [];

    return NextResponse.json({
      success: true,
      query_id: `q${type}`,
      title,
      description,
      sql: sql.trim(),
      columns,
      rows: res.rows,
      rowCount: res.rows.length,
      executionTimeMs
    });
  } catch (err: any) {
    console.error('Eval query error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
