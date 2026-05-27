import { pool } from '../pool';
import { UserRole, TrainLine, UserProfile } from '@attendance/shared';

export async function findUserByEmployeeNumber(employeeNumber: string) {
  const { rows } = await pool.query(
    `SELECT id, employee_number, name_ja, name_en, email, password_hash, role, is_active, dispatch_company
     FROM users WHERE employee_number = $1`,
    [employeeNumber]
  );
  return rows[0] as {
    id: string;
    employee_number: string;
    name_ja: string;
    name_en: string;
    email: string;
    password_hash: string;
    role: UserRole;
    is_active: boolean;
    dispatch_company: string | null;
  } | undefined;
}

export async function getUserWithTrainLines(userId: string): Promise<UserProfile | undefined> {
  const { rows } = await pool.query(
    `SELECT u.id, u.employee_number, u.name_ja, u.name_en, u.email, u.role, u.dispatch_company,
            COALESCE(
              json_agg(json_build_object('id', t.id, 'line_name_ja', t.line_name_ja, 'line_name_en', t.line_name_en))
              FILTER (WHERE t.id IS NOT NULL), '[]'
            ) AS train_lines
     FROM users u
     LEFT JOIN train_lines t ON t.employee_id = u.id
     WHERE u.id = $1
     GROUP BY u.id`,
    [userId]
  );
  if (!rows[0]) return undefined;
  const row = rows[0];
  return {
    id: row.id,
    employee_number: row.employee_number,
    name_ja: row.name_ja,
    name_en: row.name_en,
    email: row.email,
    role: row.role,
    dispatch_company: row.dispatch_company as string | null,
    trainLines: row.train_lines as TrainLine[],
  };
}

export async function saveRefreshToken(userId: string, tokenHash: string, expiresAt: Date) {
  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt]
  );
}

export async function findAndDeleteRefreshToken(tokenHash: string) {
  const { rows } = await pool.query(
    `DELETE FROM refresh_tokens WHERE token_hash = $1 AND expires_at > NOW() RETURNING user_id`,
    [tokenHash]
  );
  return rows[0] as { user_id: string } | undefined;
}

export async function getManagersByEmployeeId(employeeId: string) {
  const { rows } = await pool.query(
    `SELECT u.id, u.employee_number, u.name_ja, u.name_en, u.email
     FROM users u
     INNER JOIN employee_managers em ON em.manager_id = u.id
     WHERE em.employee_id = $1`,
    [employeeId]
  );
  return rows as { id: string; employee_number: string; name_ja: string; name_en: string; email: string }[];
}
