export type UserRole = 'applicant' | 'admin';
export type RequestType =
  | 'late' | 'early_departure' | 'absence' | 'other_request'
  | 'chokko' | 'chokki' | 'kyujitsu_shukkin';

export type ReasonCategory =
  | 'illness' | 'family' | 'personal' | 'weather_transport' | 'other';

export type LeaveType = 'paid' | 'unpaid' | 'substitute' | 'special';
export type RequestStatus = 'pending' | 'approved' | 'rejected';
export type InputLanguage = 'ja' | 'en';

export interface TrainLine {
  id: string;
  line_name_ja: string;
  line_name_en: string;
}

export interface UserProfile {
  id: string;
  employee_number: string;
  name_ja: string;
  name_en: string;
  email: string;
  role: UserRole;
  trainLines: TrainLine[];
}

export interface Manager {
  id: string;
  name_ja: string;
  name_en: string;
  email: string;
}

export interface Attachment {
  id: string;
  original_filename: string;
  file_size: number;
  uploaded_at: string;
  expires_at: string;
}

export interface Request {
  id: string;
  employee_id: string;
  employee_name_ja: string;
  employee_name_en: string;
  employee_number: string;
  request_type: RequestType;
  start_date: string;
  end_date: string | null;
  time_from: string | null;
  time_to: string | null;
  reason_category: ReasonCategory;
  reason_detail: string | null;
  train_line_id: string | null;
  train_line_name_ja: string | null;
  train_line_name_en: string | null;
  leave_type: LeaveType | null;
  admin_message: string | null;
  input_language: InputLanguage;
  status: RequestStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  submitted_at: string;
  attachment: Attachment | null;
}

export interface MessageInput {
  requestType: RequestType;
  reasonCategory?: ReasonCategory;   // optional — new types don't require a reason
  reasonDetail?: string;
  trainLineName?: string;
  startDate: string;
  endDate?: string;
  timeFrom?: string;
  timeTo?: string;
  leaveType?: LeaveType;
  adminMessage?: string;
  employeeName: { ja: string; en: string };
  inputLanguage: InputLanguage;
}

export interface MessageOutput {
  japanese: string;
  english?: string;
}

export interface NotificationInput {
  requestType: RequestType;
  startDate: string;
  endDate?: string;
  timeFrom?: string;
  timeTo?: string;
  employeeName: { ja: string; en: string };
}

export interface RejectionNotificationInput extends NotificationInput {
  rejectionReason?: string;
}
