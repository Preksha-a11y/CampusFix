import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { upvoteComplaintInMongo, getComplaintCollection } from '@/lib/mongo';
import { query } from '@/lib/db';

export async function POST(
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
    if (!complaintId) {
      return NextResponse.json({ error: 'Invalid complaint ID' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const location = body.location || 'Reported from same block';

    // 1. Live atomic update in MongoDB (Idea 1 implementation)
    const updatedDoc = await upvoteComplaintInMongo(complaintId, session.user_id, location);

    const newUpvotes = updatedDoc?.metadata?.upvote_count || 2;
    const affectedCount = updatedDoc?.metadata?.affected_users?.length || 2;

    // 2. Automated PostgreSQL Priority Escalation if multiple students report the same issue
    let escalated = false;
    if (newUpvotes >= 3) {
      const current = await query(
        `SELECT priority FROM complaints WHERE complaint_id = $1`,
        [complaintId]
      );
      if (current.rows.length > 0 && current.rows[0].priority !== 'URGENT') {
        const nextPriority = current.rows[0].priority === 'LOW' ? 'MEDIUM' : 'URGENT';
        await query(
          `UPDATE complaints SET priority = $1 WHERE complaint_id = $2`,
          [nextPriority, complaintId]
        );
        escalated = true;
      }
    }

    // 3. Insert notification for the upvoting user
    const subMsg = `You have subscribed to updates on Complaint #${complaintId} (Community Upvotes: ${newUpvotes})`;
    await query(
      `INSERT INTO notifications (user_id, complaint_id, message)
       VALUES ($1, $2, $3)`,
      [session.user_id, complaintId, subMsg]
    );

    return NextResponse.json({
      success: true,
      complaint_id: complaintId,
      upvote_count: newUpvotes,
      affected_count: affectedCount,
      priority_escalated: escalated,
      message: 'Successfully merged and upvoted existing complaint in MongoDB & PostgreSQL.',
    });
  } catch (err: any) {
    console.error('Error upvoting complaint:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
