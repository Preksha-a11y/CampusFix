import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { deleteComplaintFromMongo, getComplaintCollection } from '@/lib/mongo';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const complaintId = Number(id);

    const compRes = await query(
      `SELECT 
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
        d.department_name,
        rep.user_id AS reporter_id,
        rep.full_name AS reporter_name,
        rep.email AS reporter_email,
        staff.user_id AS staff_id,
        staff.full_name AS staff_name,
        staff.email AS staff_email,
        a.assigned_at,
        f.rating AS feedback_rating,
        f.comment AS feedback_comment,
        f.created_at AS feedback_time
       FROM complaints c
       JOIN categories cat ON c.category_id = cat.category_id
       JOIN departments d ON cat.department_id = d.department_id
       JOIN users rep ON c.reporter_id = rep.user_id
       LEFT JOIN assignments a ON c.complaint_id = a.complaint_id AND a.ended_at IS NULL
       LEFT JOIN users staff ON a.staff_id = staff.user_id
       LEFT JOIN feedback f ON c.complaint_id = f.complaint_id
       WHERE c.complaint_id = $1`,
      [complaintId]
    );

    if (compRes.rows.length === 0) {
      return NextResponse.json({ error: 'Complaint not found' }, { status: 404 });
    }

    const histRes = await query(
      `SELECT 
        sh.history_id,
        COALESCE(sh.old_status, 'INITIAL') AS old_status,
        sh.new_status,
        u.full_name AS changed_by,
        sh.changed_at,
        sh.remarks
       FROM status_history sh
       JOIN users u ON sh.changed_by = u.user_id
       WHERE sh.complaint_id = $1
         AND NOT (
           sh.remarks LIKE 'Status transitioned from % to %' 
           AND EXISTS (
             SELECT 1 FROM status_history sh2 
             WHERE sh2.complaint_id = sh.complaint_id 
               AND sh2.new_status = sh.new_status 
               AND sh2.history_id != sh.history_id
           )
         )
       ORDER BY sh.history_id ASC`,
      [complaintId]
    );

    // Get live MongoDB upvote details
    let mongoMeta: any = { upvote_count: 1, locations: [compRes.rows[0].location_text] };
    try {
      const col = await getComplaintCollection();
      const doc = await col.findOne({ complaint_id: complaintId });
      if (doc?.metadata) {
        mongoMeta = doc.metadata;
      }
    } catch {}

    return NextResponse.json({
      complaint: compRes.rows[0],
      history: histRes.rows,
      mongo_metadata: mongoMeta,
    });
  } catch (err: any) {
    console.error('Error fetching complaint details:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const complaintId = Number(id);

    // 1. Delete from PostgreSQL (CASCADE cleans up assignments, embeddings, feedback, history)
    await query(`DELETE FROM complaints WHERE complaint_id = $1`, [complaintId]);

    // 2. Delete from MongoDB
    await deleteComplaintFromMongo(complaintId);

    return NextResponse.json({ success: true, message: 'Complaint deleted from PostgreSQL & MongoDB' });
  } catch (err: any) {
    console.error('Error deleting complaint:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
