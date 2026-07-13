import { Pool, types } from 'pg';
import { config } from '../config';

// Return DATE columns as plain "YYYY-MM-DD" strings instead of JS Date objects.
// JS Date conversion shifts midnight dates by the local UTC offset, causing
// dates like "2026-05-20" to appear as "2026-05-19T15:00:00.000Z" in JST.
types.setTypeParser(types.builtins.DATE, (val) => val);

const isTest = process.env.NODE_ENV === 'test';
const connectionString = isTest ? config.databaseTestUrl : config.databaseUrl;

// SSL handling for managed cloud databases.
// Render's *external* Postgres host (…render.com) requires SSL, while its
// internal host and local/Railway internal connections do not. Auto-enable
// SSL when the host looks like a public managed endpoint, or when explicitly
// requested via DATABASE_SSL=true. rejectUnauthorized:false accepts the
// provider's certificate chain (standard for Render/Heroku-style Postgres).
const wantsSsl =
  process.env.DATABASE_SSL === 'true' || /\.render\.com/.test(connectionString ?? '');

export const pool = new Pool({
  connectionString,
  ...(wantsSsl ? { ssl: { rejectUnauthorized: false } } : {}),
});
