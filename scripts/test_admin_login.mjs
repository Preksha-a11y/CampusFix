import { query } from '../lib/db.ts';

async function testAdminQuery() {
  console.log('Testing Admin query against PostgreSQL...');
  const res = await query(
    `SELECT u.user_id, u.full_name, u.email, u.password_hash, u.is_active, u.role_id, r.role_name
     FROM users u
     JOIN roles r ON u.role_id = r.role_id
     WHERE LOWER(u.email) = LOWER($1) AND u.is_active = TRUE`,
    ['admin.campusfix@pes.edu']
  );
  console.log('Admin query result:', res.rows[0]);
  if (!res.rows[0] || res.rows[0].role_name !== 'ADMIN') {
    throw new Error('Admin query failed');
  }
  console.log('SUCCESS: Admin queried cleanly with zero SQL errors!');
  process.exit(0);
}

testAdminQuery().catch(err => {
  console.error('Query error:', err);
  process.exit(1);
});
