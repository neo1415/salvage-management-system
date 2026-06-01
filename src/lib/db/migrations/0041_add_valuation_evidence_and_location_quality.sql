ALTER TABLE "salvage_cases"
  ADD COLUMN IF NOT EXISTS "location_accuracy_meters" numeric(10, 2),
  ADD COLUMN IF NOT EXISTS "location_source" varchar(50),
  ADD COLUMN IF NOT EXISTS "location_captured_at" timestamp,
  ADD COLUMN IF NOT EXISTS "location_manual_override" boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "valuation_evidence" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "case_id" uuid REFERENCES "salvage_cases"("id"),
  "asset_type" "asset_type" NOT NULL,
  "item_identifier" jsonb NOT NULL,
  "market_evidence" jsonb NOT NULL,
  "part_evidence" jsonb,
  "decision_summary" jsonb NOT NULL,
  "created_by" uuid REFERENCES "users"("id"),
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_valuation_evidence_case" ON "valuation_evidence"("case_id");
CREATE INDEX IF NOT EXISTS "idx_valuation_evidence_asset_type" ON "valuation_evidence"("asset_type");
CREATE INDEX IF NOT EXISTS "idx_valuation_evidence_created_at" ON "valuation_evidence"("created_at");

COMMENT ON TABLE "valuation_evidence" IS 'Append-only evidence packet for AI and market valuation decisions.';
COMMENT ON COLUMN "valuation_evidence"."market_evidence" IS 'Search queries, accepted prices, rejected prices, confidence, and source quality signals used for market value.';
COMMENT ON COLUMN "valuation_evidence"."decision_summary" IS 'Confidence thresholds and manual review decision for the valuation.';
COMMENT ON COLUMN "salvage_cases"."location_accuracy_meters" IS 'Reported GPS/location accuracy at capture time. Larger values should be treated as approximate.';
COMMENT ON COLUMN "salvage_cases"."location_source" IS 'Location capture source such as gps, address, manual_pin, offline, or browser.';
