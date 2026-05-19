CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE user_role AS ENUM ('applicant', 'admin');
CREATE TYPE request_type AS ENUM ('late', 'early_departure', 'absence', 'other_request');
CREATE TYPE reason_category AS ENUM (
  'illness', 'train_delay', 'oversleeping', 'personal', 'other',
  'child_dropoff', 'work_appointment', 'other_appointment', 'direct_home'
);
CREATE TYPE leave_type AS ENUM ('paid', 'unpaid', 'substitute', 'other');
CREATE TYPE request_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE input_language AS ENUM ('ja', 'en');

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_number VARCHAR(50) UNIQUE NOT NULL,
  name_ja VARCHAR(100) NOT NULL,
  name_en VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role user_role NOT NULL DEFAULT 'applicant',
  work_start TIME,
  work_end TIME,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE train_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  line_name_ja VARCHAR(100) NOT NULL,
  line_name_en VARCHAR(100) NOT NULL
);

CREATE TABLE employee_managers (
  employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  manager_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (employee_id, manager_id)
);

CREATE TABLE requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_type request_type NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  time_from TIME,
  time_to TIME,
  reason_category reason_category NOT NULL,
  reason_detail TEXT,
  train_line_id UUID REFERENCES train_lines(id),
  leave_type leave_type,
  admin_message TEXT,
  input_language input_language NOT NULL DEFAULT 'ja',
  status request_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  original_filename VARCHAR(255) NOT NULL,
  storage_path VARCHAR(500) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_size INTEGER NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_requests_employee_id ON requests(employee_id);
CREATE INDEX idx_requests_status ON requests(status);
CREATE INDEX idx_requests_start_date ON requests(start_date);
CREATE INDEX idx_attachments_expires_at ON attachments(expires_at);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
