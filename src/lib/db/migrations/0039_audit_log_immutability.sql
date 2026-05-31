-- 0039_audit_log_immutability.sql
-- Adds tamper-evident hash-chain metadata and database-level append-only protection
-- for audit_logs.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS previous_hash varchar(64),
  ADD COLUMN IF NOT EXISTS record_hash varchar(64);

CREATE INDEX IF NOT EXISTS idx_audit_logs_record_hash ON audit_logs(record_hash);

CREATE OR REPLACE FUNCTION audit_logs_build_hash_payload()
RETURNS trigger AS $$
DECLARE
  last_hash varchar(64);
BEGIN
  -- Serialize audit inserts so concurrent requests cannot fork the hash chain.
  PERFORM pg_advisory_xact_lock(734287461);

  IF NEW.previous_hash IS NULL THEN
    SELECT record_hash
      INTO last_hash
      FROM audit_logs
      WHERE record_hash IS NOT NULL
      ORDER BY created_at DESC, id DESC
      LIMIT 1;

    NEW.previous_hash := last_hash;
  END IF;

  IF NEW.record_hash IS NULL THEN
    NEW.record_hash := encode(
      digest(
        concat_ws(
          '|',
          COALESCE(NEW.user_id::text, ''),
          COALESCE(NEW.action_type, ''),
          COALESCE(NEW.entity_type, ''),
          COALESCE(NEW.entity_id, ''),
          COALESCE(NEW.ip_address, ''),
          COALESCE(NEW.device_type::text, ''),
          COALESCE(NEW.user_agent, ''),
          COALESCE(NEW.before_state::text, ''),
          COALESCE(NEW.after_state::text, ''),
          COALESCE(NEW.previous_hash, ''),
          COALESCE(NEW.created_at::text, '')
        ),
        'sha256'
      ),
      'hex'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_logs_hash_before_insert ON audit_logs;

CREATE TRIGGER trg_audit_logs_hash_before_insert
BEFORE INSERT ON audit_logs
FOR EACH ROW
EXECUTE FUNCTION audit_logs_build_hash_payload();

CREATE OR REPLACE FUNCTION audit_logs_prevent_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only; create a compensating audit event instead';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_logs_prevent_update ON audit_logs;
DROP TRIGGER IF EXISTS trg_audit_logs_prevent_delete ON audit_logs;

CREATE TRIGGER trg_audit_logs_prevent_update
BEFORE UPDATE ON audit_logs
FOR EACH ROW
EXECUTE FUNCTION audit_logs_prevent_mutation();

CREATE TRIGGER trg_audit_logs_prevent_delete
BEFORE DELETE ON audit_logs
FOR EACH ROW
EXECUTE FUNCTION audit_logs_prevent_mutation();
