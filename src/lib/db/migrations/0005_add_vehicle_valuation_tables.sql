-- Create damage_level enum type
CREATE TYPE "damage_level" AS ENUM ('minor', 'moderate', 'severe');

-- Create vehicle_valuations table
CREATE TABLE IF NOT EXISTS "vehicle_valuations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "make" varchar(100) NOT NULL,
  "model" varchar(100) NOT NULL,
  "year" integer NOT NULL,
  "condition_category" varchar(50) NOT NULL,
  "low_price" numeric(12, 2) NOT NULL,
  "high_price" numeric(12, 2) NOT NULL,
  "average_price" numeric(12, 2) NOT NULL,
  "mileage_low" integer,
  "mileage_high" integer,
  "market_notes" text,
  "data_source" varchar(100) NOT NULL,
  "created_by" uuid NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- Create unique constraint for vehicle_valuations
ALTER TABLE "vehicle_valuations" ADD CONSTRAINT "vehicle_valuations_make_model_year_condition_category_unique" UNIQUE("make", "model", "year", "condition_category");

-- Create indexes for vehicle_valuations
CREATE INDEX IF NOT EXISTS "idx_valuations_make_model" ON "vehicle_valuations"("make", "model");
CREATE INDEX IF NOT EXISTS "idx_valuations_year" ON "vehicle_valuations"("year");
CREATE INDEX IF NOT EXISTS "idx_valuations_make_model_year" ON "vehicle_valuations"("make", "model", "year");

-- Create damage_deductions table
CREATE TABLE IF NOT EXISTS "damage_deductions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "component" varchar(100) NOT NULL,
  "damage_level" "damage_level" NOT NULL,
  "repair_cost_estimate" numeric(12, 2) NOT NULL,
  "valuation_deduction_percent" numeric(5, 4) NOT NULL,
  "description" text,
  "created_by" uuid NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- Create unique constraint for damage_deductions
ALTER TABLE "damage_deductions" ADD CONSTRAINT "damage_deductions_component_damage_level_unique" UNIQUE("component", "damage_level");

-- Create index for damage_deductions
CREATE INDEX IF NOT EXISTS "idx_deductions_component" ON "damage_deductions"("component");

-- Create valuation_audit_logs table
CREATE TABLE IF NOT EXISTS "valuation_audit_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "action" varchar(20) NOT NULL,
  "entity_type" varchar(50) NOT NULL,
  "entity_id" uuid NOT NULL,
  "changed_fields" jsonb,
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp NOT NULL DEFAULT now()
);

-- Create indexes for valuation_audit_logs
CREATE INDEX IF NOT EXISTS "idx_valuation_audit_entity" ON "valuation_audit_logs"("entity_type", "entity_id");
CREATE INDEX IF NOT EXISTS "idx_valuation_audit_user" ON "valuation_audit_logs"("user_id");
CREATE INDEX IF NOT EXISTS "idx_valuation_audit_created" ON "valuation_audit_logs"("created_at");
