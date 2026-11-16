import { NextRequest, NextResponse } from 'next/server';
import { query, isUsingPostgres } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { generateEmbedding, toVectorString } from '@/lib/vector';
import { syncComplaintToMongo, getComplaintCollection } from '@/lib/mongo';
import crypto from 'crypto';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const reporterId = searchParams.get('reporter_id');
    const staffId = searchParams.get('staff_id');
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    let sql = `
      SELECT 
        c.complaint_id,
        c.title,
        c.description,
        c.location_text,
        c.priority,
        c.status,
        c.created_at,
        c.resolved_at,
        cat.category_id,
        cat.category_name,
        cat.target_hours,
        d.department_id,
        d.department_name,
        rep.user_id AS reporter_id,
        rep.full_name AS reporter_name,
        rep.email AS reporter_email,
        staff.user_id AS staff_id,
        staff.full_name AS staff_name,
        a.assigned_at,
        f.rating AS feedback_rating,
        f.comment AS feedback_comment
      FROM complaints c
      JOIN categories cat ON c.category_id = cat.category_id
      JOIN departments d ON cat.department_id = d.department_id
      JOIN users rep ON c.reporter_id = rep.user_id
      LEFT JOIN assignments a ON c.complaint_id = a.complaint_id AND a.ended_at IS NULL
      LEFT JOIN users staff ON a.staff_id = staff.user_id
      LEFT JOIN feedback f ON c.complaint_id = f.complaint_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (reporterId) {
      params.push(Number(reporterId));
      sql += ` AND c.reporter_id = $${params.length}`;
    }

    if (staffId) {
      params.push(Number(staffId));
      sql += ` AND a.staff_id = $${params.length}`;
    }

    if (status) {
      params.push(status);
      sql += ` AND c.status = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (c.title ILIKE $${params.length} OR c.description ILIKE $${params.length} OR c.location_text ILIKE $${params.length})`;
    }

    sql += ` ORDER BY c.complaint_id DESC`;

    const res = await query(sql, params);

    // Fetch MongoDB upvote metadata in batch for live reflecting
    try {
      const col = await getComplaintCollection();
      const ids = res.rows.map(r => r.complaint_id);
      const mongoDocs = await col.find({ complaint_id: { $in: ids } }).toArray();
      const upvoteMap = new Map(mongoDocs.map(d => [d.complaint_id, d.metadata?.upvote_count || 1]));
      const affectedMap = new Map(mongoDocs.map(d => [d.complaint_id, d.metadata?.affected_users?.length || 1]));

      const enriched = res.rows.map(r => ({
        ...r,
        upvote_count: upvoteMap.get(r.complaint_id) || 1,
        affected_count: affectedMap.get(r.complaint_id) || 1,
      }));
      return NextResponse.json({ complaints: enriched });
    } catch {
      return NextResponse.json({ complaints: res.rows });
    }
  } catch (err: any) {
    console.error('Error fetching complaints:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { category_id, title, description, location_text, priority } = body;

    if (!category_id || !title || !description || !location_text || !priority) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    // Begin ACID transaction
    await query('BEGIN');

    // 1. Insert into complaints
    const insertRes = await query(
      `INSERT INTO complaints (reporter_id, category_id, title, description, location_text, priority, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'SUBMITTED')
       RETURNING complaint_id, created_at`,
      [session.user_id, Number(category_id), title, description, location_text, priority]
    );
    const complaintId = insertRes.rows[0].complaint_id;

    // 2. Insert initial status_history
    await query(
      `INSERT INTO status_history (complaint_id, changed_by, old_status, new_status, remarks)
       VALUES ($1, $2, NULL, 'SUBMITTED', 'Complaint submitted by reporter')`,
      [complaintId, session.user_id]
    );

    // 3. Generate dense vector embedding (384-d) and store in complaint_embeddings
    const fullText = `${title} ${description} ${location_text}`;
    const vec = generateEmbedding(fullText);
    const contentHash = crypto.createHash('sha256').update(fullText).digest('hex');

    if (isUsingPostgres()) {
      const vecStr = toVectorString(vec);
      await query(
        `INSERT INTO complaint_embeddings (complaint_id, embedding, model_name, content_hash)
         VALUES ($1, $2::vector, 'all-MiniLM-L6-v2', $3)`,
        [complaintId, vecStr, contentHash]
      );
    } else {
      await query(
        `INSERT INTO complaint_embeddings (complaint_id, embedding_json, model_name, content_hash)
         VALUES ($1, $2, 'all-MiniLM-L6-v2', $3)`,
        [complaintId, JSON.stringify(vec), contentHash]
      );
    }

    // 4. Notify admin users
    await query(
      `INSERT INTO notifications (user_id, complaint_id, message)
       SELECT u.user_id, $1, 'New complaint #' || $1 || ' submitted: ' || $2
       FROM users u
       JOIN roles r ON u.role_id = r.role_id
       WHERE r.role_name = 'ADMIN'`,
      [complaintId, title]
    );

    await query('COMMIT');

    // 5. Get category and department details for live MongoDB document synchronization
    const metaRes = await query(
      `SELECT c.category_name, d.department_name
       FROM categories c
       JOIN departments d ON c.department_id = d.department_id
       WHERE c.category_id = $1`,
      [category_id]
    );
    const catName = metaRes.rows[0]?.category_name || 'General';
    const deptName = metaRes.rows[0]?.department_name || 'General Maintenance';

    // 6. Live sync to MongoDB (reflects user creation in real time)
    await syncComplaintToMongo({
      complaint_id: complaintId,
      title,
      description,
      category: catName,
      department: deptName,
      location: location_text,
      priority,
      status: 'SUBMITTED',
      reporter_id: session.user_id,
    });

    return NextResponse.json({ success: true, complaint_id: complaintId });
  } catch (err: any) {
    await query('ROLLBACK').catch(() => {});
    console.error('Error creating complaint:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
