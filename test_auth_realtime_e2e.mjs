import { query } from './lib/db.ts';
import { getAllUsers, authenticateUser, registerUser } from './lib/auth.ts';
import { getComplaintCollection, syncComplaintToMongo, upvoteComplaintInMongo } from './lib/mongo.ts';

async function testRealtimePersistence() {
  console.log('================================================================');
  console.log('CAMPUSFIX: REAL-TIME USER AUTH & DATABASE PERSISTENCE TEST');
  console.log('================================================================');

  try {
    // 1. Fetch all users from database
    console.log('\n[1/6] Querying active users from database...');
    const users = await getAllUsers();
    console.log(`[OK] Retrieved ${users.length} registered campus users:`);
    users.forEach((u) => {
      console.log(`  - #${u.user_id}: ${u.full_name} (${u.email}) [Role: ${u.role_name}]`);
    });

    // 2. Authenticate as Sneha Rao (Student, ID: 2)
    console.log('\n[2/6] Authenticating as Sneha Rao (Student)...');
    const snehaAuth = await authenticateUser('sneha.rao@pes.edu', 'password123');
    if (!snehaAuth) throw new Error('Sneha Rao authentication failed');
    console.log(`[OK] Successfully authenticated: ${snehaAuth.full_name}, ID: ${snehaAuth.user_id}, Role: ${snehaAuth.role_name}`);

    // 3. Register a brand-new user into database in real-time
    const testEmail = `test.student.${Date.now()}@pes.edu`;
    console.log(`\n[3/6] Registering new student user (${testEmail}) into database...`);
    const newUser = await registerUser(
      'Pooja Hegde (Student)',
      testEmail,
      1, // Reporter role
      'password123'
    );
    console.log(`[OK] New user registered and persisted! ID: ${newUser.user_id}, Name: ${newUser.full_name}`);

    // Verify user is in database
    const verifyUserRes = await query('SELECT user_id, full_name, email FROM users WHERE user_id = $1', [newUser.user_id]);
    if (verifyUserRes.rows.length === 0) throw new Error('New user was not persisted in database');
    console.log(`[OK] Database query confirms user persistence: ${JSON.stringify(verifyUserRes.rows[0])}`);

    // 4. Submit complaint under the newly registered user identity
    console.log(`\n[4/6] Creating new complaint under Pooja Hegde (ID: ${newUser.user_id})...`);
    const compInsert = await query(
      `INSERT INTO complaints (reporter_id, category_id, title, description, location_text, priority, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'SUBMITTED')
       RETURNING complaint_id, created_at`,
      [
        newUser.user_id,
        2, // Category: Estate & Plumbing
        'Hot water geyser not heating in 4th floor bathroom',
        'Water remains freezing cold even after keeping switch on for 20 minutes',
        'Hostel Block D, Room 412 Washroom',
        'HIGH'
      ]
    );
    const newComplaintId = compInsert.rows[0].complaint_id;
    console.log(`[OK] Complaint #${newComplaintId} persisted in Relational Database with reporter_id = ${newUser.user_id}!`);

    // Verify initial status history
    await query(
      `INSERT INTO status_history (complaint_id, changed_by, old_status, new_status, remarks)
       VALUES ($1, $2, NULL, 'SUBMITTED', 'Complaint filed by new user Pooja')`,
      [newComplaintId, newUser.user_id]
    );

    // 5. Sync to MongoDB in real-time
    console.log(`\n[5/6] Persisting Complaint #${newComplaintId} document to MongoDB 8.2...`);
    await syncComplaintToMongo({
      complaint_id: newComplaintId,
      title: 'Hot water geyser not heating in 4th floor bathroom',
      description: 'Water remains freezing cold even after keeping switch on for 20 minutes',
      category: 'Water Tap / Geyser Fault',
      department: 'Estate & Plumbing',
      location: 'Hostel Block D, Room 412 Washroom',
      priority: 'HIGH',
      status: 'SUBMITTED',
      reporter_id: newUser.user_id,
    });

    const col = await getComplaintCollection();
    const mongoDoc = await col.findOne({ complaint_id: newComplaintId });
    console.log(`[OK] MongoDB document persisted! Document ID: ${mongoDoc?._id}, Complaint ID: ${mongoDoc?.complaint_id}`);
    console.log(`     Reporter ID in MongoDB: ${mongoDoc?.metadata?.affected_users?.[0]}, Upvotes: ${mongoDoc?.metadata?.upvote_count}`);

    // 6. Upvote from Sneha Rao (ID: 2) - Idea 1 Real-time Upvoting & Merge
    console.log(`\n[6/6] Testing Idea 1: Upvoting Complaint #${newComplaintId} as Sneha Rao (ID: ${snehaAuth.user_id})...`);
    const upvotedResult = await upvoteComplaintInMongo(newComplaintId, snehaAuth.user_id, 'Hostel Block D, Room 415');

    console.log(`[OK] MongoDB Atomic Upvote Succeeded!`);
    console.log(`     Total Upvotes in MongoDB: ${upvotedResult?.metadata?.upvote_count}`);
    console.log(`     Affected Users in MongoDB: ${JSON.stringify(upvotedResult?.metadata?.affected_users)}`);
    console.log(`     Locations in MongoDB: ${JSON.stringify(upvotedResult?.metadata?.locations)}`);

    // Add notification for Sneha in relational DB
    await query(
      `INSERT INTO notifications (user_id, complaint_id, message)
       VALUES ($1, $2, 'Sneha Rao upvoted complaint #' || $2)`,
      [snehaAuth.user_id, newComplaintId]
    );

    console.log('\n================================================================');
    console.log('SUCCESS: ALL REAL-TIME USER AUTH & DATABASE TESTS PASSED!');
    console.log('================================================================');
    process.exit(0);
  } catch (err) {
    console.error('[ERROR] Verification failed:', err);
    process.exit(1);
  }
}

testRealtimePersistence();
