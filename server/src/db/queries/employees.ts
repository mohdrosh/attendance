import bcrypt from 'bcryptjs';
import { pool } from '../pool';
import type { UserRole, AuditAction } from '@attendance/shared';

export interface CreateEmployeeData {
  employee_number: string;
  name_ja: string;
  name_en: string;
  email: string;
  password: string;
  role: UserRole;
}

export interface UpdateEmployeeData {
  employee_number?: string;
  name_ja?: string;
  name_en?: string;
  email?: string;
  role?: UserRole;
  work_start?: string;
  work_end?: string;
}

export async function createEmployee(data: CreateEmployeeData): Promise<string> {
  const passwordHash = await bcrypt.hash(data.password, 10);
  const { rows } = await pool.query(
    `INSERT INTO users (employee_number, name_ja, name_en, email, password_hash, role)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [data.employee_number, data.name_ja, data.name_en, data.email, passwordHash, data.role]
  );
  return rows[0].id as string;
}

export async function listEmployees() {
  const { rows } = await pool.query(
    `SELECT id, employee_number, name_ja, name_en, email, role, is_active, dispatch_company
     FROM users ORDER BY name_ja`
  );
  return rows;
}

export async function getEmployeeById(id: string) {
  const { rows } = await pool.query(
    `SELECT u.id, u.employee_number, u.name_ja, u.name_en, u.email, u.role,
            u.is_active, u.work_start, u.work_end, u.dispatch_company,
            COALESCE(
              (
                SELECT json_agg(json_build_object(
                  'id', t2.id, 'line_name_ja', t2.line_name_ja, 'line_name_en', t2.line_name_en
                ))
                FROM train_lines t2
                WHERE t2.employee_id = u.id
              ),
              '[]'
            ) AS train_lines,
            COALESCE(
              (
                SELECT json_agg(json_build_object(
                  'id', m2.id, 'name_ja', m2.name_ja, 'name_en', m2.name_en, 'email', m2.email
                ))
                FROM employee_managers em2
                JOIN users m2 ON m2.id = em2.manager_id
                WHERE em2.employee_id = u.id
              ),
              '[]'
            ) AS managers
     FROM users u
     WHERE u.id = $1`,
    [id]
  );
  return rows[0] as Record<string, unknown> | undefined;
}

const ALLOWED_COLUMNS = new Set(['employee_number', 'name_ja', 'name_en', 'email', 'role', 'work_start', 'work_end', 'dispatch_company']);

export async function updateEmployee(id: string, data: UpdateEmployeeData): Promise<boolean> {
  const entries = Object.entries(data).filter(([k, v]) => ALLOWED_COLUMNS.has(k) && v !== undefined);
  if (entries.length === 0) return false;
  const setClause = entries.map(([k], i) => `${k} = $${i + 2}`).join(', ');
  const values = entries.map(([, v]) => v);
  const result = await pool.query(`UPDATE users SET ${setClause} WHERE id = $1`, [id, ...values]);
  return (result.rowCount ?? 0) > 0;
}

export async function assignManager(employeeId: string, managerId: string): Promise<void> {
  await pool.query(
    `INSERT INTO employee_managers (employee_id, manager_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [employeeId, managerId]
  );
}

export async function removeManager(employeeId: string, managerId: string): Promise<number> {
  const { rowCount } = await pool.query(
    `DELETE FROM employee_managers WHERE employee_id = $1 AND manager_id = $2`,
    [employeeId, managerId]
  );
  return rowCount ?? 0;
}

export async function addTrainLine(
  employeeId: string,
  data: { line_name_ja: string; line_name_en: string }
): Promise<string> {
  const { rows } = await pool.query(
    `INSERT INTO train_lines (employee_id, line_name_ja, line_name_en) VALUES ($1, $2, $3) RETURNING id`,
    [employeeId, data.line_name_ja, data.line_name_en]
  );
  return rows[0].id as string;
}

export async function removeTrainLine(lineId: string): Promise<number> {
  const { rowCount } = await pool.query(`DELETE FROM train_lines WHERE id = $1`, [lineId]);
  return rowCount ?? 0;
}

export async function writeAuditLog(params: {
  employee_id: string | null;
  changed_by: string;
  action: AuditAction;
  changes?: Record<string, { from: string; to: string }> | null;
  snapshot?: Record<string, string> | null;
}): Promise<void> {
  await pool.query(
    `INSERT INTO employee_audit_log (employee_id, changed_by, action, changes, snapshot)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      params.employee_id,
      params.changed_by,
      params.action,
      params.changes ? JSON.stringify(params.changes) : null,
      params.snapshot ? JSON.stringify(params.snapshot) : null,
    ]
  );
}

export async function getAuditLog(employeeId: string) {
  const { rows } = await pool.query(
    `SELECT al.id, al.action, al.changes, al.snapshot, al.changed_at,
            u.name_ja AS changed_by_name_ja, u.name_en AS changed_by_name_en
     FROM employee_audit_log al
     LEFT JOIN users u ON u.id = al.changed_by
     WHERE al.employee_id = $1
     ORDER BY al.changed_at DESC`,
    [employeeId]
  );
  return rows;
}

export async function deactivateEmployee(id: string): Promise<'ok' | 'not_found' | 'already_inactive'> {
  const { rows } = await pool.query(`SELECT is_active FROM users WHERE id = $1`, [id]);
  if (!rows[0]) return 'not_found';
  if (!rows[0].is_active) return 'already_inactive';
  await pool.query(`UPDATE users SET is_active = false WHERE id = $1`, [id]);
  return 'ok';
}

export async function reactivateEmployee(id: string): Promise<'ok' | 'not_found' | 'already_active'> {
  const { rows } = await pool.query(`SELECT is_active FROM users WHERE id = $1`, [id]);
  if (!rows[0]) return 'not_found';
  if (rows[0].is_active) return 'already_active';
  await pool.query(`UPDATE users SET is_active = true WHERE id = $1`, [id]);
  return 'ok';
}

export async function deleteEmployee(id: string): Promise<boolean> {
  const { rowCount } = await pool.query(`DELETE FROM users WHERE id = $1`, [id]);
  return (rowCount ?? 0) > 0;
}

export async function resetEmployeePassword(id: string, passwordHash: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE users SET password_hash = $1 WHERE id = $2`,
    [passwordHash, id]
  );
  return (rowCount ?? 0) > 0;
}

export async function getEmployeeSnapshot(id: string): Promise<Record<string, string> | null> {
  const { rows } = await pool.query(
    `SELECT employee_number, name_ja, name_en, email, role FROM users WHERE id = $1`,
    [id]
  );
  if (!rows[0]) return null;
  return rows[0] as Record<string, string>;
}
