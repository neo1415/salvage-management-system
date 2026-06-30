CREATE TABLE IF NOT EXISTS "user_trusted_login_contexts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "device_fingerprint_hash" varchar(64) NOT NULL,
  "ip_prefix_hash" varchar(64) NOT NULL,
  "user_agent_hash" varchar(64) NOT NULL,
  "successful_login_count" integer DEFAULT 0 NOT NULL,
  "trusted" boolean DEFAULT false NOT NULL,
  "trusted_at" timestamp,
  "last_seen_at" timestamp DEFAULT now() NOT NULL,
  "revoked_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "login_risk_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "device_fingerprint_hash" varchar(64) NOT NULL,
  "ip_prefix_hash" varchar(64) NOT NULL,
  "user_agent_hash" varchar(64) NOT NULL,
  "risk_type" varchar(80) NOT NULL,
  "risk_score" integer NOT NULL,
  "decision" varchar(80) NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_trusted_login_context_unique"
  ON "user_trusted_login_contexts" ("user_id", "device_fingerprint_hash", "ip_prefix_hash")
  WHERE "revoked_at" IS NULL;

CREATE INDEX IF NOT EXISTS "idx_trusted_login_context_user"
  ON "user_trusted_login_contexts" ("user_id", "last_seen_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_login_risk_events_user_created"
  ON "login_risk_events" ("user_id", "created_at" DESC);

