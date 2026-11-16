import { query } from '../lib/db.ts';

async function updateTrigger() {
  console.log('Updating trigger function trg_fn_complaint_status_audit in Supabase PostgreSQL...');
  
  await query(`
    CREATE OR REPLACE FUNCTION trg_fn_complaint_status_audit()
    RETURNS TRIGGER AS $$
    BEGIN
      IF (OLD.status IS DISTINCT FROM NEW.status) THEN
        -- Auto-manage resolved_at timestamp
        IF NEW.status = 'RESOLVED' THEN
          NEW.resolved_at := CURRENT_TIMESTAMP;
        ELSIF OLD.status = 'RESOLVED' AND NEW.status <> 'RESOLVED' THEN
          NEW.resolved_at := NULL;
        END IF;
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  console.log('Deleting duplicate trigger placeholder rows from status_history...');
  const delRes = await query(`
    DELETE FROM status_history
    WHERE remarks LIKE 'Status transitioned from % to %'
      AND EXISTS (
        SELECT 1 FROM status_history sh2
        WHERE sh2.complaint_id = status_history.complaint_id
          AND sh2.new_status = status_history.new_status
          AND sh2.history_id != status_history.history_id
      )
  `);
  console.log('Cleaned up duplicate rows count:', delRes.rowCount);
  console.log('SUCCESS: Trigger updated and status_history audit cleaned up!');
  process.exit(0);
}

updateTrigger().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
