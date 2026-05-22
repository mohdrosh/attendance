BEGIN;

ALTER TABLE requests ALTER COLUMN reason_category TYPE text;

DROP TYPE reason_category;

CREATE TYPE reason_category AS ENUM (
  'illness', 'family', 'personal', 'weather_transport', 'other',
  'client_meeting', 'different_office', 'work_event', 'substitute_day'
);

ALTER TABLE requests
  ALTER COLUMN reason_category TYPE reason_category
  USING reason_category::reason_category;

COMMIT;
