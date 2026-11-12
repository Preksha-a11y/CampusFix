import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query, getPgPool } from '@/lib/db';
import { updateComplaintStatusInMongo } from '@/lib/mongo';

export async function GET() {
  try {
    // List available active maintenance staff
    const res = await query(
      `SELECT u.user_id, u.full_name, u.email
       FROM users u
       JOIN roles r ON u.role_id = r.role_id
       WHERE r.role_name = 'STAFF' AND u.is_active = TRUE
       ORDER BY u.full_name ASC`
    );
    return NextResponse.json({ staff: res.rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    const session = await getSession();
    if (!session || session.role_name !== 'ADMIN') {
      return NextResponse.json({ error: 'Only admins can assign technicians' }, { status: 403 });
    }

    const { id } = await params;
    const complaintId = Number(id);
    const { staff_id } = await req.json();

    if (!staff_id) {
      return NextResponse.json({ error: 'Staff ID required' }, { status: 400 });
    }

    await client.query('BEGIN');

    // 1. Close any existing active assignment
    await client.query(
      `UPDATE assignments
       SET ended_at = CURRENT_TIMESTAMP
       WHERE complaint_id = $1 AND ended_at IS NULL`,
      [complaintId]
    );

    // 2. Insert new assignment
    await client.query(
      `INSERT INTO assignments (complaint_id, staff_id, assigned_by, assigned_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
      [complaintId, staff_id, session.user_id]
    );

    // 3. Update status to ASSIGNED if currently SUBMITTED
    await client.query(
      `UPDATE complaints
       SET status = 'ASSIGNED'
       WHERE complaint_id = $1 AND status = 'SUBMITTED'`,
      [complaintId]
    );

    // 4. Notify technician
    await client.query(
      `INSERT INTO notifications (user_id, complaint_id, message)
       VALUES ($1, $2, 'You have been assigned to complaint #' || $2)`,
      [staff_id, complaintId]
    );

    await client.query('COMMIT');

    // Update MongoDB metadata
    await updateComplaintStatusInMongo(complaintId, 'ASSIGNED', 'Assigned to maintenance technician');

    return NextResponse.json({ success: true, complaint_id: complaintId, staff_id });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Error assigning staff:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    client.release();
  }
}
