import bcrypt from 'bcryptjs';
import { pool } from '../pool';
import type { UserRole } from '@attendance/shared';

export interface CreateEmployeeData {
  employee_number: string;
  name_ja: string;
  name_en: string;
  email: string;
  password: string;
  role: UserRole;
}

export interface UpdateEmployeeData {
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
    `SELECT id, employee_number, name_ja, name_en, email, role
     FROM users ORDER BY name_ja`
  );
  return rows;
}

export async function getEmployeeById(id: string) {
  const { rows } = await pool.query(
    `SELECT u.id, u.employee_number, u.name_ja, u.name_en, u.email, u.role,
            u.work_start, u.work_end,
            COALESCE(
              json_agg(DISTINCT jsonb_build_object(
                'id', t.id, 'line_name_ja', t.line_name_ja, 'line_name_en', t.line_name_en
              )) FILTER (WHERE t.id IS NOT NULL), '[]'
            ) AS train_lines,
            COALESCE(
              json_agg(DISTINCT jsonb_build_object(
                'id', m.id, 'name_ja', m.name_ja, 'name_en', m.name_en, 'email', m.email
              )) FILTER (WHERE m.id IS NOT NULL), '[]'
            ) AS managers
     FROM users u
     LEFT JOIN train_lines t ON t.employee_id = u.id
     LEFT JOIN employee_managers em ON em.employee_id = u.id
     LEFT JOIN users m ON m.id = em.manager_id
     WHERE u.id = $1
     GROUP BY u.id`,
    [id]
  );
  return rows[0] as Record<string, unknown> | undefined;
}

export async function updateEmployee(id: string, data: UpdateEmployeeData): Promise<void> {
  const entries = Object.entries(data).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return;
  const setClause = entries.map(([k], i) => `${k} = $${i + 2}`).join(', ');
  const values = entries.map(([, v]) => v);
  await pool.query(`UPDATE users SET ${setClause} WHERE id = $1`, [id, ...values]);
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
