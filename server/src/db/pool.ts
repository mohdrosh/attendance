import { Pool, types } from 'pg';
import { config } from '../config';

// Return DATE columns as plain "YYYY-MM-DD" strings instead of JS Date objects.
// JS Date conversion shifts midnight dates by the local UTC offset, causing
// dates like "2026-05-20" to appear as "2026-05-19T15:00:00.000Z" in JST.
types.setTypeParser(types.builtins.DATE, (val) => val);

const isTest = process.env.NODE_ENV === 'test';

export const pool = new Pool({
  connectionString: isTest ? config.databaseTestUrl : config.databaseUrl,
});
