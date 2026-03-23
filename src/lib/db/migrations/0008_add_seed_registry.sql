-- Migration: Add seed registry table for tracking seed script executions
-- Feature: enterprise-data-seeding-system
-- Requirements: 5.2, 11.1

-- Begin transaction for atomic migration
BEGIN;

-- Create seed_registry table
CREATE TABLE IF NOT EXISTS "seed_registry" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "script_name" varchar(255) NOT NULL UNIQUE,
  "executed_at" timestamp NOT NULL DEFAULT now(),
  "status" varchar(20) NOT NULL,
  "records_affected" integer DEFAULT 0,
  "records_imported" integer DEFAULT 0,
  "records_updated" integer DEFAULT 0,
  "records_skipped" integer DEFAULT 0,
  "error_message" text,
  "execution_time_ms" integer,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "idx_seed_registry_script_name" ON "seed_registry" ("script_name");
CREATE INDEX IF NOT EXISTS "idx_seed_registry_status" ON "seed_registry" ("status");
CREATE INDEX IF NOT EXISTS "idx_seed_registry_executed_at" ON "seed_registry" ("executed_at");

-- Add comments for documentation
COMMENT ON TABLE seed_registry IS 'Tracks execution history of seed scripts for idempotent seeding';
COMMENT ON COLUMN seed_registry.script_name IS 'Unique identifier for the seed script (e.g., toyota-valuations)';
COMMENT ON COLUMN seed_registry.executed_at IS 'Timestamp when the seed script started execution';
COMMENT ON COLUMN seed_registry.status IS 'Execution status: running, completed, or failed';
COMMENT ON COLUMN seed_registry.records_affected IS 'Total number of records affected (imported + updated)';
COMMENT ON COLUMN seed_registry.records_imported IS 'Number of new records inserted';
COMMENT ON COLUMN seed_registry.records_updated IS 'Number of existing records updated';
COMMENT ON COLUMN seed_registry.records_skipped IS 'Number of records skipped due to errors or validation failures';
COMMENT ON COLUMN seed_registry.error_message IS 'Error message if status is failed';
COMMENT ON COLUMN seed_registry.execution_time_ms IS 'Total execution time in milliseconds';

-- Commit transaction
COMMIT;
