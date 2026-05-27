-- Add missing reason_category enum values
-- train_delay: for late arrival when train is delayed
-- oversleeping: for late arrival when oversleeping

ALTER TYPE reason_category ADD VALUE IF NOT EXISTS 'train_delay';
ALTER TYPE reason_category ADD VALUE IF NOT EXISTS 'oversleeping';
