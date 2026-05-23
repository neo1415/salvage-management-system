# NEM Salvage Security And Scalability Posture Plan

Last reviewed: 2026-05-22

This plan is for hardening NEM Salvage without changing business logic casually. The application handles identity, KYC, auctions, wallet balances, frozen funds, generated legal documents, payments, notifications, and fraud evidence, so every change should preserve auditability and user fairness.

## Current Risk Snapshot

### Critical / Immediate

- Main dependency audit is now clean at `npm audit --audit-level=moderate`.
- Socket sidecar dependency audit is clean at `npm audit --prefix socket-sidecar --audit-level=moderate`.
- `next.config.ts` now has `typescript.ignoreBuildErrors: false`, and the production build/type validation passes.
- Upload signing now has authentication, role checks, file validation, and route-specific rate limiting. Keep reviewing any future signed upload route against the same pattern.
- Dojah KYC is wired into provider verification, audit, fraud, and Tier 2 review paths, but production readiness still depends on deployed migrations, correct webhook URL, correct Dojah dashboard services, and manual QA of clean/risky flows.

### High

- Role enforcement must be centralized and audited. The valid roles in this app include `system_admin`, `salvage_manager`, `finance_officer`, `claims_adjuster`, and `vendor`; aliases like `admin` or `manager` should not silently grant access.
- Auction bidding, payment, escrow, and fallback workflows have received first-pass safety hardening, including bid request validation, bid rate limiting, safer failed-deposit rollback, and corrected previous-bidder deposit-rate handling. They still need load testing under concurrent users.
- WebSocket support cannot rely on Vercel. Socket.io needs a separate sidecar service or a managed realtime provider, with polling remaining the fallback.
- MFA appears half-finished. Finish it behind a feature flag and require it first for staff roles, not vendors, to avoid punishing users during onboarding.
- Business configuration now has a short in-memory cache with invalidation on update. Multi-instance deployments should keep the TTL short or add distributed invalidation.

## Security Review Plan By Surface

### Registration And Onboarding

- Confirm every registration path validates email, phone, password strength, user type, business details, and OTP verification server-side.
- Rate-limit by purpose, not with one global setting:
  - registration create: low frequency per IP/device/email/phone
  - OTP send/resend: strict per phone/email and IP
  - OTP verify: strict attempts per reference
  - BVN/Dojah: strict per vendor and provider reference, with idempotency
- Prevent duplicate identity abuse using normalized phone/email, Dojah duplicate checks, and internal duplicate checks.
- Keep failures helpful but non-enumerating. Do not reveal whether a phone/email exists unless the user is in a controlled recovery flow.

### Authentication And Session

- Verify login uses httpOnly secure cookies in production with correct `SameSite` for the deployed topology.
- Ensure `/api/auth/me` returns only the fields the client needs: user id, role, verification gates, display name, session metadata. No sensitive KYC, BVN, NIN, secrets, or raw provider data.
- Implement MFA completion for staff roles first. Vendors can be offered optional MFA until onboarding friction is understood.
- Track device/session metadata server-side for staff and high-risk vendor actions.
- Add forced logout/session revocation for suspended, blocked, deleted, or role-changed users.

### Authorization

- Replace scattered role string checks with shared permission helpers where practical.
- For each API route, verify:
  - authenticated actor
  - permitted role
  - object ownership or operational scope
  - state transition validity
  - audit event on sensitive mutations
- Staff pages must not rely on UI hiding alone. Every API powering a staff page needs server-side authorization.

### Client/Server Data Movement

- Treat all client fields as untrusted. Never trust vendorId, userId, amount, auction status, bid increment, wallet balance, payment status, KYC status, or role coming from the browser.
- Prefer server-derived values for bid eligibility, wallet/frozen funds, winning status, payment deadlines, document signing state, and KYC gates.
- Mask BVN, NIN, ID numbers, document numbers, provider payloads, and raw fraud evidence everywhere except restricted server-side audit/evidence storage.

### Dojah / KYC / Fraud

- Dojah should remain evidence, not the final decision authority. Tier 2 must stay manual review.
- Webhook handling must stay idempotent and auditable:
  - received
  - matched/unmatched
  - normalized
  - provider verification stored
  - fraud alert created/updated when risk exists
  - vendor moved to pending review
- Dojah raw payload access should be restricted to privileged server code and never shown in normal UI.
- Fraud alerts should include Dojah, app-native bidding risk, auth/session risk, payment risk, and admin abuse signals in one internal review flow.

### Auction And Bidding

- REST bidding endpoint remains the source of truth. Socket.io should never become the authority for placing bids.
- Enforce bid eligibility, KYC tier, deposit freeze, wallet balance, auction state, auction deadline, minimum increment, and self-bid prevention inside a transaction or equivalent locking strategy.
- Use route-specific rate limiting:
  - bid placement: allows realistic auction bursts but throttles automation per vendor/auction/IP/device
  - auction polling: higher allowance but cache-friendly and bounded
  - auction management: strict staff mutation limits
- Preserve deterministic fallback logic for winner forfeiture, deposit transfer, second/third bidder promotion, and grace periods.

### Payments, Wallets, And Ledger

- Paystack remains payment provider. Dojah should not touch payments.
- Payment verification must be idempotent by provider reference.
- Ledger entries should be append-only. Wallet balances should be reconcilable from ledger, frozen funds, and Paystack transactions.
- Finance actions such as grace period, transfer, forfeiture, refund, or manual adjustment must create audit logs and include actor/reason.

### Documents And Evidence

- Generated documents must be immutable after signing except through explicit versioning.
- Signature placement and receipt generation should stay deterministic and auditable.
- Evidence exports should be redacted by default and restricted to authorized staff.

### Notifications

- Notification preferences should be enforced at send time, not only in UI.
- SMS should be reserved for high-value events: OTP, auction won, forfeiture, grace period, critical payment/pickup actions.
- Push/email/SMS notification fan-out should eventually move to a queue so critical auction/payment routes are not slowed by provider latency.

### Logging And Audit

- App logs should never include full BVN/NIN/ID numbers, raw provider payloads, cookies, tokens, or secrets.
- Audit logs should be structured, actor-bound, and immutable for:
  - auth and MFA changes
  - KYC provider events
  - fraud alert actions
  - vendor approval/rejection/suspension/blocking
  - wallet/payment/ledger changes
  - auction lifecycle changes
  - document signing/generation
- Add alerting for repeated webhook failures, payment mismatch, sudden bidding anomalies, high auth failure rate, and high 5xx rate.

### PWA / Future Mobile App

- Keep auth in secure httpOnly cookies for web/PWA where possible.
- Avoid storing sensitive KYC or tokens in localStorage/IndexedDB.
- Service worker caches must exclude authenticated API responses, KYC data, wallet data, documents, and admin pages unless explicitly encrypted and scoped.
- Camera/geolocation permissions must explain what is needed and degrade gracefully.

### White-Label / Multi-Instance Security

For the near term, use white-labeled isolated deployments:

- one codebase
- separate database per customer
- separate storage/cloud folders
- separate Paystack/Dojah/Resend/Termii keys
- separate app URL and webhook URLs
- separate brand config

This is safer and faster than true multi-tenancy because it avoids cross-tenant data leakage. The later SaaS version should introduce tenant IDs, tenant-aware RLS, tenant-scoped secrets, tenant-scoped queues, and tenant-aware audit logs.

## Scalability Plan

### Database

- Completed first pass: added migration `0036_add_scalability_indexes.sql` for hot bid, auction, payment, document, audit, Dojah verification, fraud, and notification query shapes.
- Still required: run `EXPLAIN ANALYZE` against staging/prod data and adjust indexes based on real query plans.
- Convert slow dashboard/report queries into shared metric services with tested definitions.
- Keep writes idempotent and transactionally safe.
- Use cursor pagination for large lists.

### Caching

- Cache read-heavy public-ish data carefully, but never cache stale approval queues for 10 minutes again.
- Use explicit invalidation after case creation, approval, auction creation, bid placement, payment verification, KYC completion, and fraud alert action.
- Avoid user-insensitive cache keys for role-specific or vendor-specific data.

### Queues

Move these to background jobs as the app grows:

- PDF generation
- reports
- notification fan-out
- fraud analysis
- Dojah provider retries
- reconciliation jobs
- document regeneration and receipt generation

Keep these synchronous:

- bid placement authorization and persistence
- wallet balance/frozen fund updates
- payment reference verification and idempotency gate
- auth/session checks

### Realtime

- Polling remains primary until the sidecar is deployed and tested.
- Socket.io sidecar should broadcast read-only UI updates only.
- Main app should publish events to sidecar through a private HTTP endpoint or shared broker.
- Do not let Socket.io place bids or mutate money.

## Known Cleanup Candidates To Review

Do not delete these blindly. They are candidates for later cleanup after import/runtime confirmation:

- `server.ts`: useful for local/custom Socket.io server, but not Vercel production.
- `src/app/api/socket/route.ts`: status route only; cannot initialize Socket.io under App Router.
- old archived scripts/tests that break repo-wide TypeScript checks.
- duplicate historical docs after current deployment guide is consolidated.
- legacy manual KYC pieces after Dojah transition is stable, if still unreachable.
- socket diagnostic scripts if the Render sidecar replaces their purpose.

## Hardening Phases

### Phase 1: Build And Dependency Integrity

- Completed: fixed production build/type validation, removed ignored TypeScript build errors, applied dependency patches, and verified main + sidecar audits clean.
- Completed: targeted Dojah tests pass.
- Remaining: expand targeted auth/payment/auction/document tests beyond the Dojah suite.

### Phase 2: Access Control And Audit

- Centralize permission checks.
- Add route inventory and expected roles.
- Verify each sensitive mutation has audit logging.
- Complete staff-first MFA.

### Phase 3: Auction/Payment Race Safety

- Completed first pass: bid placement validates payloads, throttles per vendor/auction, preserves REST as source of truth, and conditionally restores auction state if deposit freeze fails after bid persistence.
- Completed first pass: payment initiation routes have vendor/auction scoped rate limits and no longer return stack traces/internal errors to the browser on key payment failures.
- Review wallet/frozen funds transitions under load.
- Review Paystack webhook idempotency.
- Load-test auction polling and bid bursts.

### Phase 4: KYC/Fraud Operations

- QA clean and risky Dojah flows.
- Verify Dojah fraud alerts in System Admin.
- Verify vendor pending review in Salvage Manager.
- Add provider retry queue.

### Phase 5: Realtime Sidecar

- Completed first pass: socket sidecar exists as a deployable package with build/audit passing, internal broadcast auth/rate limiting, UUID/event validation, and a main-app bridge for watch-count broadcasts.
- Deploy Socket.io sidecar to Render.
- Configure Vercel with sidecar URL and internal broadcast secret.
- Keep polling primary.
- Test watch counts and UI updates.
- Promote Socket.io to primary only after reliability is proven.

### Phase 6: White-Label Readiness

- Extract brand, onboarding, KYC, auction, payment, document, notification, and fraud settings into configuration.
- Add customer bootstrap script for new isolated deployments.
- Produce tenant/customer deployment checklist.
