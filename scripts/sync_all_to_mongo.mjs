import { query } from '../lib/db.ts';
import { syncComplaintToMongo, getComplaintCollection } from '../lib/mongo.ts';

async function syncAll() {
  console.log('Fetching all complaints from PostgreSQL...');
  const res = await query(`
    SELECT 
      c.complaint_id, c.title, c.description, c.location_text, c.priority, c.status,
      c.reporter_id, cat.category_name, d.department_name
    FROM complaints c
    JOIN categories cat ON c.category_id = cat.category_id
    JOIN departments d ON cat.department_id = d.department_id
    ORDER BY c.complaint_id ASC;
  `);

  console.log(`Found ${res.rows.length} complaints in PostgreSQL. Syncing each to MongoDB...`);
  for (const r of res.rows) {
    await syncComplaintToMongo({
      complaint_id: Number(r.complaint_id),
      title: r.title,
      description: r.description,
      category: r.category_name,
      department: r.department_name,
      location: r.location_text,
      priority: r.priority,
      status: r.status,
      reporter_id: Number(r.reporter_id),
    });
  }

  const col = await getComplaintCollection();
  const count = await col.countDocuments();
  console.log(`SUCCESS! Total documents now in MongoDB complaint_documents: ${count}`);
  const allDocs = await col.find({}, { projection: { complaint_id: 1, title: 1, status: 1 } }).sort({ complaint_id: 1 }).toArray();
  console.table(allDocs);
  process.exit(0);
}

syncAll().catch(err => {
  console.error('Sync failed:', err);
  process.exit(1);
});
