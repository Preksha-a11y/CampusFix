import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query } from '@/lib/db';
import { updateComplaintStatusInMongo, getComplaintCollection } from '@/lib/mongo';

export async function PATCH(
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
    const { status, remarks } = await req.json();

    if (!['SUBMITTED', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    // 1. Fetch current status & reporter
    const current = await query(
      `SELECT status, reporter_id, title FROM complaints WHERE complaint_id = $1`,
      [complaintId]
    );
    if (current.rows.length === 0) {
      return NextResponse.json({ error: 'Complaint not found' }, { status: 404 });
    }

    const oldStatus = current.rows[0].status;
    const reporterId = current.rows[0].reporter_id;
    const title = current.rows[0].title;

    // 2. Update PostgreSQL (Trigger trg_complaint_status_audit handles resolved_at and audit trail)
    await query(
      `UPDATE complaints SET status = $1 WHERE complaint_id = $2`,
      [status, complaintId]
    );

    // Explicitly add technician audit remarks if provided
    if (remarks) {
      await query(
        `INSERT INTO status_history (complaint_id, changed_by, old_status, new_status, remarks)
         VALUES ($1, $2, $3, $4, $5)`,
        [complaintId, session.user_id, oldStatus, status, remarks]
      );
    }

    // 3. Live update MongoDB document
    await updateComplaintStatusInMongo(complaintId, status, remarks);

    // 4. Notify the reporter
    const reporterMsg = `Complaint #${complaintId} (${title}) was updated to ${status}`;
    await query(
      `INSERT INTO notifications (user_id, complaint_id, message)
       VALUES ($1, $2, $3)`,
      [reporterId, complaintId, reporterMsg]
    );

    // 5. Also notify any community students who upvoted this ticket via MongoDB affected_users
    try {
      const col = await getComplaintCollection();
      const doc = await col.findOne({ complaint_id: complaintId });
      const affected = doc?.metadata?.affected_users || [];
      const upvoteMsg = `The issue you upvoted #${complaintId} (${title}) has been updated to ${status}`;
      for (const uId of affected) {
        if (uId !== reporterId && uId !== session.user_id) {
          await query(
            `INSERT INTO notifications (user_id, complaint_id, message)
             VALUES ($1, $2, $3)`,
            [uId, complaintId, upvoteMsg]
          );
        }
      }
    } catch (err) {
      console.warn('Notice: upvoted user notification skipped:', err);
    }

    return NextResponse.json({ success: true, complaint_id: complaintId, status });
  } catch (err: any) {
    console.error('Error updating status:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
