import { query } from '../lib/db.ts';

async function verify() {
  const h = await query(`
    SELECT sh.history_id, sh.old_status, sh.new_status, u.full_name, sh.remarks, sh.changed_at 
    FROM status_history sh
    JOIN users u ON sh.changed_by = u.user_id
    WHERE sh.complaint_id = 11
    ORDER BY sh.history_id ASC
  `);
  console.log('Complaint 11 Cleaned History:');
  console.table(h.rows);
  process.exit(0);
}

verify().catch(console.error);
