import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
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
    const { rating, comment } = await req.json();

    const r = Number(rating);
    if (!r || r < 1 || r > 5) {
      return NextResponse.json({ error: 'Rating must be an integer between 1 and 5' }, { status: 400 });
    }

    // Verify complaint is resolved and belongs to reporter (or admin)
    const check = await query(
      `SELECT status, reporter_id FROM complaints WHERE complaint_id = $1`,
      [complaintId]
    );

    if (check.rows.length === 0) {
      return NextResponse.json({ error: 'Complaint not found' }, { status: 404 });
    }

    if (check.rows[0].status !== 'RESOLVED') {
      return NextResponse.json({ error: 'Feedback can only be submitted for resolved complaints' }, { status: 400 });
    }

    // Upsert into feedback table
    await query(
      `INSERT INTO feedback (complaint_id, rating, comment, created_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (complaint_id) 
       DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment, created_at = CURRENT_TIMESTAMP`,
      [complaintId, r, comment || null]
    );

    return NextResponse.json({ success: true, complaint_id: complaintId, rating: r });
  } catch (err: any) {
    console.error('Error submitting feedback:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
