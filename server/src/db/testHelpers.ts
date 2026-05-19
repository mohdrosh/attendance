import { pool } from './pool';

export async function clearDatabase() {
  await pool.query(`
    TRUNCATE TABLE attachments, requests, employee_managers, train_lines, refresh_tokens, users
    RESTART IDENTITY CASCADE
  `);
}

export async function closePool() {
  await pool.end();
}
