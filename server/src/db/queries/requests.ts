import { pool } from '../pool';
import { Request as AttendanceRequest, RequestType, ReasonCategory, LeaveType, InputLanguage } from '@attendance/shared';

export interface CreateRequestInput {
  employeeId: string;
  requestType: RequestType;
  startDate: string;
  endDate?: string;
  timeFrom?: string;
  timeTo?: string;
  reasonCategory?: ReasonCategory | '';
  reasonDetail?: string;
  trainLineId?: string;
  leaveType?: LeaveType;
  adminMessage?: string;
  inputLanguage: InputLanguage;
}

export async function createRequest(input: CreateRequestInput): Promise<string> {
  const { rows } = await pool.query(
    `INSERT INTO requests
      (employee_id, request_type, start_date, end_date, time_from, time_to,
       reason_category, reason_detail, train_line_id, leave_type, admin_message, input_language)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
    [
      input.employeeId, input.requestType, input.startDate,
      input.endDate ?? null, input.timeFrom ?? null, input.timeTo ?? null,
      input.reasonCategory || null, input.reasonDetail ?? null, input.trainLineId ?? null,
      input.leaveType ?? null, input.adminMessage ?? null, input.inputLanguage,
    ]
  );
  return rows[0].id as string;
}

export async function createAttachment(requestId: string, data: {
  originalFilename: string;
  storagePath: string;
  mimeType: string;
  fileSize: number;
}) {
  const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
  await pool.query(
    `INSERT INTO attachments (request_id, original_filename, storage_path, mime_type, file_size, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [requestId, data.originalFilename, data.storagePath, data.mimeType, data.fileSize, expiresAt]
  );
}

export async function getRequestsByEmployee(employeeId: string): Promise<AttendanceRequest[]> {
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
     WHERE r.employee_id = $1
     ORDER BY r.submitted_at DESC`,
    [employeeId]
  );
  return rows;
}
