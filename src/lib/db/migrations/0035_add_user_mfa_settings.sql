-- Phase 2 prep: optional login MFA (not enforced until login flow is wired)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS mfa_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS mfa_channel varchar(20) NOT NULL DEFAULT 'email';

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS mfa_phone varchar(20);

COMMENT ON COLUMN users.mfa_enabled IS 'When true, login requires second factor (Phase 2)';
COMMENT ON COLUMN users.mfa_channel IS 'sms | email | both — preferred MFA delivery';
COMMENT ON COLUMN users.mfa_phone IS 'Optional override phone for MFA SMS';
