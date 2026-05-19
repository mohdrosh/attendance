import cron from 'node-cron';
import fs from 'fs';
import { pool } from '../db/pool';

export function startCleanupJob() {
  cron.schedule('0 0 * * *', async () => {
    try {
      const { rows } = await pool.query(
        `DELETE FROM attachments WHERE expires_at < NOW() RETURNING storage_path`
      );
      for (const row of rows) {
        if (fs.existsSync(row.storage_path)) {
          fs.unlinkSync(row.storage_path);
        }
      }
      if (rows.length > 0) console.log(`Cleanup: deleted ${rows.length} expired attachments`);
    } catch (err) {
      console.error('Cleanup job error:', err);
    }
  });
}
