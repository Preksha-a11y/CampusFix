import { query, isUsingPostgres } from './lib/db.ts';
import { MongoClient } from 'mongodb';

const mongoClient = new MongoClient(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017');

async function runE2ETest() {
  console.log('================================================================');
  console.log('CAMPUSFIX FULL-STACK END-TO-END VERIFICATION');
  console.log('================================================================');

  try {
    // 1. Verify Relational Connection (Dual Engine: Supabase Cloud / Local Fallback)
    console.log('[1/5] Testing Relational Database engine...');
    const compRes = await query('SELECT count(*) as count FROM complaints;');
    const totalComplaints = compRes.rows[0].count;
    console.log(`[OK] Connected! Active backend: ${isUsingPostgres() ? 'Supabase PostgreSQL 17 + pgvector' : 'Local SQLite Fallback (campusfix.db)'}`);
    console.log(`     Total complaints registered: ${totalComplaints}`);

    // 2. Verify MongoDB Connection & Collection
    console.log('[2/5] Testing Local MongoDB 8.2 connection...');
    await mongoClient.connect();
    const db = mongoClient.db('campusfix_nosql');
    const collection = db.collection('complaint_documents');
    const mongoCount = await collection.countDocuments();
    console.log(`[OK] MongoDB connected live! Documents in collection: ${mongoCount}`);

    // 3. Test Idea 1: Real-time duplicate upvoting & merge
    console.log('[3/5] Testing Idea 1: Duplicate Upvoting & Merge...');
    const targetCompRes = await query(
      "SELECT complaint_id, title, priority, status FROM complaints WHERE status != 'RESOLVED' ORDER BY complaint_id ASC LIMIT 1;"
    );
    const testComplaint = targetCompRes.rows[0];
    const testId = Number(testComplaint.complaint_id);
    console.log(`Targeting Complaint #${testId}: "${testComplaint.title}" (Priority: ${testComplaint.priority})`);

    // Ensure document exists in Mongo
    await collection.updateOne(
      { complaint_id: testId },
      {
        $setOnInsert: {
          complaint_id: testId,
          title: testComplaint.title,
          status: testComplaint.status,
          metadata: {
            upvote_count: 0,
            affected_users: [],
            upvote_locations: []
          }
        }
      },
      { upsert: true }
    );

    // Perform atomic upvote
    const dummyUserId = 101;
    const testLocation = 'Engineering Block 3rd Floor Washroom';
    await collection.updateOne(
      { complaint_id: testId },
      {
        $inc: { 'metadata.upvote_count': 1 },
        $addToSet: {
          'metadata.affected_users': dummyUserId,
          'metadata.upvote_locations': testLocation
        },
        $set: { updated_at: new Date() }
      }
    );

    const updatedDoc = await collection.findOne({ complaint_id: testId });
    console.log(`[OK] MongoDB Document Updated! Upvote Count: ${updatedDoc.metadata.upvote_count}, Affected Users: ${JSON.stringify(updatedDoc.metadata.affected_users)}`);

    // 4. Test View: view_department_analytics & Bottleneck Factor
    console.log('[4/5] Testing Analytics View & Department Bottleneck Factor...');
    const analyticsRes = await query(`
      SELECT department_id, department_name, total_complaints, pending_complaints, resolved_complaints
      FROM view_department_analytics;
    `);
    console.log(`[OK] Loaded analytics for ${analyticsRes.rows.length} departments:`);
    for (const r of analyticsRes.rows) {
      console.log(`  - Dept #${r.department_id} (${r.department_name}): Total=${r.total_complaints}, Pending=${r.pending_complaints}`);
    }

    // 5. Test Mandatory Syllabus 5-Table JOIN Query
    console.log('[5/5] Testing Mandatory 5-Table JOIN Query...');
    const joinRes = await query(`
      SELECT 
        c.complaint_id,
        c.title,
        c.priority,
        c.status,
        dept.department_name,
        cat.category_name,
        reporter.full_name AS reported_by,
        COALESCE(staff.full_name, 'Unassigned') AS assigned_technician
      FROM complaints c
      JOIN categories cat ON c.category_id = cat.category_id
      JOIN departments dept ON cat.department_id = dept.department_id
      JOIN users reporter ON c.reporter_id = reporter.user_id
      LEFT JOIN assignments a ON c.complaint_id = a.complaint_id AND a.ended_at IS NULL
      LEFT JOIN users staff ON a.staff_id = staff.user_id
      ORDER BY c.complaint_id DESC
      LIMIT 3;
    `);
    console.log(`[OK] 5-Table JOIN returned ${joinRes.rows.length} records cleanly:`);
    for (const r of joinRes.rows) {
      console.log(`  - #${r.complaint_id}: "${r.title}" | Dept: ${r.department_name} | By: ${r.reported_by} | Staff: ${r.assigned_technician}`);
    }

    console.log('\n================================================================');
    console.log('ALL E2E VERIFICATION CHECKS PASSED SUCCESSFULLY!');
    console.log('================================================================');

  } catch (err) {
    console.error('[ERROR] E2E Verification failed:', err);
  } finally {
    await mongoClient.close();
  }
}

runE2ETest();
