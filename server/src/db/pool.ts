import { Pool } from 'pg';
import { config } from '../config';

const isTest = process.env.NODE_ENV === 'test';

export const pool = new Pool({
  connectionString: isTest ? config.databaseTestUrl : config.databaseUrl,
});
