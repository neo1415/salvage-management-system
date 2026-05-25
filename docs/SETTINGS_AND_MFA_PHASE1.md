# Settings (Phase 1) and MFA (Phase 2 prep)

## Phase 1 — shipped

- **Shared settings** at `/settings/*` for all dashboard roles (vendor, manager, adjuster, finance, admin).
- **Profile**: read-only account info + **phone change with SMS OTP** (email backup via existing `otp.service`).
- **Notifications**: channel toggles for everyone; auction-specific toggles for vendors only.
- **Security**: save preferred MFA channel (`email` | `sms` | `both`) and optional MFA phone — **login is not enforced yet**.
- **Change password**: `POST /api/auth/change-password` (all roles).
- **Profile photo**: `/settings/profile-picture` (unchanged path, now under settings layout).
- **Vendors**: old `/vendor/settings/profile|notifications|change-password` URLs redirect to `/settings/*`. Transactions stay at `/vendor/settings/transactions`.

### APIs

| Route | Purpose |
|-------|---------|
| `GET /api/settings/profile` | Profile + vendor block + security summary |
| `POST /api/settings/profile/phone/request` | OTP to new phone |
| `POST /api/settings/profile/phone/verify` | Confirm OTP, update phone |
| `GET/PATCH /api/settings/security` | MFA preferences (Phase 2) |

### Database

Run migration `src/lib/db/migrations/0035_add_user_mfa_settings.sql`:

- `users.mfa_enabled` (default `false`)
- `users.mfa_channel` (default `email`)
- `users.mfa_phone` (optional)

## Phase 2 — not enabled

1. Set `MFA_LOGIN_ENFORCED=true` when login challenge is implemented.
2. After credentials `authorize`, if `user.mfa_enabled`, issue short-lived pending cookie → `/login/verify-mfa` → `verifyOTPCode` on email/SMS → complete session.
3. Optional: `PATCH /api/settings/security` to set `mfa_enabled: true` only after successful test OTP.

OTP service already has `verifyOTPCode()` and context `phone_change` for non-registration flows.
