-- server/src/db/migrations/003_update_enums.sql

-- Convert enum columns to text so we can drop the types
ALTER TABLE requests ALTER COLUMN request_type   TYPE text;
ALTER TABLE requests ALTER COLUMN reason_category TYPE text;
ALTER TABLE requests ALTER COLUMN leave_type      TYPE text;

-- Drop old enum types
DROP TYPE request_type;
DROP TYPE reason_category;
DROP TYPE leave_type;

-- Migrate existing reason_category values
UPDATE requests SET reason_category = 'weather_transport' WHERE reason_category = 'train_delay';
UPDATE requests SET reason_category = 'other'             WHERE reason_category = 'oversleeping';
UPDATE requests SET reason_category = 'family'            WHERE reason_category = 'child_dropoff';
UPDATE requests SET reason_category = 'personal'          WHERE reason_category IN ('work_appointment', 'other_appointment');
UPDATE requests SET reason_category = 'other'             WHERE reason_category = 'direct_home';

-- Migrate existing leave_type values
UPDATE requests SET leave_type = 'special' WHERE leave_type = 'other';

-- Create new enum types
CREATE TYPE request_type AS ENUM (
  'late', 'early_departure', 'absence', 'other_request',
  'chokko', 'chokki', 'kyujitsu_shukkin'
);
CREATE TYPE reason_category AS ENUM (
  'illness', 'family', 'personal', 'weather_transport', 'other'
);
CREATE TYPE leave_type AS ENUM ('paid', 'unpaid', 'substitute', 'special');

-- Restore columns to new enum types (NULL-safe -- nullable columns handled by USING)
ALTER TABLE requests ALTER COLUMN request_type
  TYPE request_type USING request_type::request_type;
ALTER TABLE requests ALTER COLUMN reason_category
  TYPE reason_category USING reason_category::reason_category;
ALTER TABLE requests ALTER COLUMN leave_type
  TYPE leave_type USING leave_type::leave_type;
