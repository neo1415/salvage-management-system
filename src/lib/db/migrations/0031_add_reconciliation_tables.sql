-- Migration: Add Reconciliation Tables
-- Purpose: Enable daily reconciliation between database and Paystack balances
-- Safety: This is an ADDITIVE migration - no existing tables are modified

-- Reconciliation Logs Table
-- Tracks daily reconciliation attempts and results
CREATE TABLE IF NOT EXISTS "reconciliation_logs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "reconciliation_date" DATE NOT NULL,
  "paystack_balance" NUMERIC(12, 2) NOT NULL,
  "database_balance" NUMERIC(12, 2) NOT NULL,
  "discrepancy" NUMERIC(12, 2) NOT NULL,
  "status" VARCHAR(20) NOT NULL CHECK (status IN ('passed', 'failed')),
  "details" JSONB,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for reconciliation_logs
CREATE INDEX IF NOT EXISTS "reconciliation_logs_date_idx" ON "reconciliation_logs" ("reconciliation_date");
CREATE INDEX IF NOT EXISTS "reconciliation_logs_status_idx" ON "reconciliation_logs" ("status");

-- Unmatched Transactions Table
-- Tracks transactions that don't match between Paystack and database
CREATE TABLE IF NOT EXISTS "unmatched_transactions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "source" VARCHAR(20) NOT NULL CHECK (source IN ('paystack', 'database', 'both')),
  "reference" VARCHAR(255) NOT NULL,
  "paystack_amount" NUMERIC(12, 2),
  "database_amount" NUMERIC(12, 2),
  "status" VARCHAR(50) NOT NULL CHECK (status IN ('missing_in_database', 'missing_in_paystack', 'amount_mismatch')),
  "resolved_at" TIMESTAMP,
  "resolved_by" UUID REFERENCES "users"("id"),
  "resolution_notes" VARCHAR(500),
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for unmatched_transactions
CREATE INDEX IF NOT EXISTS "unmatched_transactions_reference_idx" ON "unmatched_transactions" ("reference");
CREATE INDEX IF NOT EXISTS "unmatched_transactions_status_idx" ON "unmatched_transactions" ("status");
CREATE INDEX IF NOT EXISTS "unmatched_transactions_created_at_idx" ON "unmatched_transactions" ("created_at");

-- Reconciliation Alerts Table
-- Tracks alerts sent to finance officers and admins
CREATE TABLE IF NOT EXISTS "reconciliation_alerts" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "reconciliation_log_id" UUID REFERENCES "reconciliation_logs"("id"),
  "alert_type" VARCHAR(50) NOT NULL CHECK (alert_type IN ('discrepancy', 'unmatched_transaction', 'anomaly')),
  "severity" VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  "message" VARCHAR(500) NOT NULL,
  "sent_to" JSONB NOT NULL,
  "acknowledged_by" UUID REFERENCES "users"("id"),
  "acknowledged_at" TIMESTAMP,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for reconciliation_alerts
CREATE INDEX IF NOT EXISTS "reconciliation_alerts_type_idx" ON "reconciliation_alerts" ("alert_type");
CREATE INDEX IF NOT EXISTS "reconciliation_alerts_severity_idx" ON "reconciliation_alerts" ("severity");
CREATE INDEX IF NOT EXISTS "reconciliation_alerts_created_at_idx" ON "reconciliation_alerts" ("created_at");

-- Comments for documentation
COMMENT ON TABLE "reconciliation_logs" IS 'Daily reconciliation between database balances and Paystack balance';
COMMENT ON TABLE "unmatched_transactions" IS 'Transactions that don''t match between Paystack and database';
COMMENT ON TABLE "reconciliation_alerts" IS 'Alerts sent to finance officers and admins for discrepancies';
