# Offline-First And Risk-Based Authentication Plan

## Current State

Salvage Bridge already has the base PWA pieces for field case capture:

- case drafts are saved in IndexedDB
- offline cases are saved locally with photos, client image metadata, GPS location, voice notes, and asset details
- pending/error cases sync through `/api/cases/sync` when connectivity returns
- selected vendor-facing data has read-through cache hooks
- service worker registration is production-only to avoid stale Turbopack chunks during development

The most important immediate gap was duplicate sync ownership. Multiple UI hooks, banners, service-worker messages, or online events could call sync at the same time. That is now handled by sharing the active sync promise instead of throwing `Sync already in progress`.

## Offline Capability Boundaries

### Claims Adjuster

Target behavior:

- can open the installed PWA after prior online login
- can create and edit local drafts
- can capture photos
- can preserve client-side EXIF/device metadata before upload
- can record or type voice notes
- can save complete field cases locally
- can submit only when online
- can retry sync and resolve duplicate claim-reference conflicts when online

Do not run these offline:

- AI damage assessment
- market search
- final case submission
- approval workflow
- policy/core-system claim lookup

### Salvage Manager

Target behavior:

- can view recently cached portfolio/approval data as read-only
- cannot approve, reject, rerun AI, edit valuation, or publish auctions offline

### Vendor

Target behavior:

- can view cached won-auction/pickup instructions if already loaded
- cannot bid, pay, upload pickup evidence, sign documents, or confirm pickup offline

### Finance Officer

Target behavior:

- can view cached dashboards/reports if already loaded
- cannot confirm payments, refunds, or wallet actions offline

## Offline Login Recommendation

Do not implement true offline server login. The safer model is a trusted-device unlock:

1. User logs in online successfully.
2. The device stores a short-lived offline access grant for low-risk local features only.
3. The grant is bound to user id, role, device key, app version, and expiry.
4. The grant is encrypted with Web Crypto using a non-extractable key where supported.
5. Offline unlock requires local device authentication where available, or a local PIN/passphrase.
6. Offline unlock never creates a server session and never permits sensitive server actions.
7. On reconnect, the app refreshes the real session, syncs drafts, and revokes local unlock if the account/policy changed.

Recommended default expiry:

- claims adjuster: 24-72 hours
- manager/finance/admin: disabled initially
- vendor: disabled initially

## Risk-Based MFA Recommendation

Add a server-side trusted login profile instead of relying on local storage.

Tables:

- `user_trusted_devices`
  - `id`
  - `user_id`
  - `device_fingerprint_hash`
  - `device_label`
  - `last_ip_hash`
  - `ip_prefix_hash`
  - `successful_login_count`
  - `trusted_at`
  - `last_seen_at`
  - `revoked_at`

- `login_risk_events`
  - `id`
  - `user_id`
  - `risk_type`
  - `risk_score`
  - `ip_hash`
  - `device_fingerprint_hash`
  - `user_agent_hash`
  - `decision`
  - `created_at`

Decision rules:

- require OTP for unknown device
- require OTP for known device with unusual IP/location
- require OTP for impossible travel, new country, or suspicious velocity
- mark a device trusted only after successful OTP and repeated low-risk logins
- require OTP before adding/removing trusted devices
- always require policy MFA when the business policy says so

Suggested trust threshold:

- 1 successful OTP lets the user continue for that session
- 5 successful low-risk logins over at least 2 days marks the device as trusted
- 30-60 days of inactivity removes trust

## Implementation Phases

1. Stabilize current offline capture
   - keep field drafts local
   - keep sync idempotent
   - show clear pending/synced/error states
   - add integration tests for duplicate sync and sync retry

2. Add trusted-device schema and risk scoring
   - device fingerprint hash
   - IP prefix hash, not raw IP in trust logic
   - audit every risk decision
   - add admin visibility for recent risk events

3. Add step-up MFA during login
   - preserve current MFA policy requirements
   - add risk-triggered OTP when policy MFA is off
   - generic user-facing copy: `We need to verify this sign-in`

4. Add offline trusted-device unlock for claims adjusters
   - low-risk local drafts only
   - no server writes until online session refresh
   - explicit banner: `Offline mode - saved locally`

5. Add core-system claim lookup caching
   - cache only claim snapshots required for field capture
   - expire quickly
   - never cache core-system credentials client-side

## Non-Negotiables

- no session token in `localStorage`
- no password hash or OTP secret in IndexedDB
- no offline approval, payment, bidding, pickup confirmation, or admin setup changes
- validate all IndexedDB data again on sync
- treat local drafts as user-controlled input
- server remains source of truth
