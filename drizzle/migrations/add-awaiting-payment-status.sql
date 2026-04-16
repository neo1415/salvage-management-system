-- Add 'awaiting_payment' to auction_status enum
-- This status is used when all documents are signed and vendor must choose payment method

ALTER TYPE auction_status ADD VALUE IF NOT EXISTS 'awaiting_payment';
