import { pool } from '../pool';
import { Request as AttendanceRequest, RequestStatus, RequestType } from '@attendance/shared';

export interface AdminRequestFilters {
  name?: string;
  type?: RequestType;
  from?: string;
  to?: string;
  status?: RequestStatus;
}

export async function getAllRequests(filters: AdminRequestFilters): Promise<AttendanceRequest[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  if (filters.name) {
    conditions.push(`(u.name_ja ILIKE $${i} OR u.name_en ILIKE $${i} OR u.employee_number ILIKE $${i})`);
    params.push(`%${filters.name}%`);
    i++;
  }
  if (filters.type) {
    conditions.push(`r.request_type = $${i++}`);
    params.push(filters.type);
  }
  if (filters.from) {
    conditions.push(`r.start_date >= $${i++}`);
    params.push(filters.from);
  }
  if (filters.to) {
    conditions.push(`r.start_date <= $${i++}`);
    params.push(filters.to);
  }
  if (filters.status) {
    conditions.push(`r.status = $${i++}`);
    params.push(filters.status);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await pool.query(
    `SELECT r.*,
            u.name_ja AS employee_name_ja, u.name_en AS employee_name_en, u.employee_number,
            t.line_name_ja AS train_line_name_ja, t.line_name_en AS train_line_name_en,
            CASE WHEN a.id IS NOT NULL THEN json_build_object(
              'id', a.id, 'original_filename', a.original_filename,
              'file_size', a.file_size, 'uploaded_at', a.uploaded_at, 'expires_at', a.expires_at
            ) END AS attachment
     FROM requests r
     JOIN users u ON u.id = r.employee_id
     LEFT JOIN train_lines t ON t.id = r.train_line_id
     LEFT JOIN attachments a ON a.request_id = r.id
     ${where}
     ORDER BY r.submitted_at DESC`,
    params
  );
  return rows;
}

