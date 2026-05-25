ALTER TABLE users ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE employee_audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES users(id) ON DELETE SET NULL,
  changed_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  action      TEXT NOT NULL,
  changes     JSONB,
  snapshot    JSONB
);

CREATE INDEX idx_audit_log_employee_id ON employee_audit_log(employee_id);
CREATE INDEX idx_audit_log_changed_at  ON employee_audit_log(changed_at);
