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
  try {
    const session = await getSession();
    if (session && session.role_name === 'REPORTER') {
      return NextResponse.json({ error: 'Only admins can assign technicians' }, { status: 403 });
    }

    const adminId = session?.user_id ? Number(session.user_id) : 8;
    const { id } = await params;
    const complaintId = Number(id);
    const { staff_id } = await req.json();

    if (!staff_id) {
      return NextResponse.json({ error: 'Staff ID required' }, { status: 400 });
    }

    await query('BEGIN');

    // 1. Close any existing active assignment
    await query(
      `UPDATE assignments
       SET ended_at = CURRENT_TIMESTAMP
       WHERE complaint_id = $1 AND ended_at IS NULL`,
      [complaintId]
    );

    // 2. Insert new assignment
    await query(
      `INSERT INTO assignments (complaint_id, staff_id, assigned_by, assigned_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
      [complaintId, Number(staff_id), adminId]
    );

    // 3. Update status to ASSIGNED if currently SUBMITTED
    const updateRes = await query(
      `UPDATE complaints
       SET status = 'ASSIGNED'
       WHERE complaint_id = $1 AND status = 'SUBMITTED'`,
      [complaintId]
    );

    if (updateRes.rowCount && updateRes.rowCount > 0) {
      await query(
        `INSERT INTO status_history (complaint_id, changed_by, old_status, new_status, remarks)
         VALUES ($1, $2, 'SUBMITTED', 'ASSIGNED', 'Technician assigned by admin')`,
        [complaintId, adminId]
      );
    }

    // 4. Notify technician
    const staffMsg = `You have been assigned to complaint #${complaintId}`;
    await query(
      `INSERT INTO notifications (user_id, complaint_id, message)
       VALUES ($1, $2, $3)`,
      [staff_id, complaintId, staffMsg]
    );

    await query('COMMIT');

    // Update MongoDB metadata
    await updateComplaintStatusInMongo(complaintId, 'ASSIGNED', 'Assigned to maintenance technician');

    return NextResponse.json({ success: true, complaint_id: complaintId, staff_id });
  } catch (err: any) {
    await query('ROLLBACK').catch(() => {});
    console.error('Error assigning staff:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
