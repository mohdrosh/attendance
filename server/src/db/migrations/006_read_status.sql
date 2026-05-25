CREATE TABLE request_read_status (
  request_id UUID REFERENCES requests(id) ON DELETE CASCADE,
  admin_id   UUID REFERENCES users(id) ON DELETE CASCADE,
  read_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (request_id, admin_id)
);

CREATE INDEX idx_read_status_admin_id ON request_read_status(admin_id);
