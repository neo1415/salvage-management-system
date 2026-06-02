# Pickup Confirmation and Training Data Pipeline Spec

Date: 2026-06-02

Status: planning/specification only. This document is based on the code currently wired into the application. It does not describe aspirational code as if it already exists.

## Executive Summary

Two related gaps need to be closed before the platform can honestly present the post-payment journey as enterprise-grade.

1. Pickup is partially implemented, but the current workflow is not the operational gate workflow the product needs. The code has pickup authorization documents, pickup confirmation columns, vendor/admin confirmation APIs, reminders, dashboard counts, and tests. However, the actual flow is mostly "vendor confirms pickup first, then admin confirms" instead of "paid auction becomes pickup-ready, operational staff verifies a secure pickup code at release, then the auction/case/reporting lifecycle moves to completed pickup."
2. The intelligence/training-data foundation exists, but event capture is too narrow for serious model training. The code has predictions, recommendations, interactions, fraud alerts, ML dataset exports, feature engineering, analytics routes, and documentation. It does not yet capture enough product behavior, domain events, and curated labels to train strong pricing, fraud, recommendation, and operational SLA models.

Recommended ownership:

- Primary pickup operator: `salvage_manager`, because pickup is an asset-release and salvage-operations control.
- Oversight/override: `system_admin`.
- Finance: read-only operational visibility after payment, plus exception escalation where settlement/payment is disputed.
- Vendor: receives pickup authorization, sees pickup status, and may confirm intent/arrival, but should not be the role that makes final release authoritative.

The right target is a secure, auditable, staff-confirmed pickup workflow with global code lookup, auction-level code confirmation, pickup status transitions, dashboards, reports, and training data events.

## Current Evidence in Code

### Pickup Evidence

| Area | Evidence | Current state |
| --- | --- | --- |
| Auction pickup fields | `src/lib/db/schema/auctions.ts` | `pickupConfirmedVendor`, `pickupConfirmedVendorAt`, `pickupConfirmedAdmin`, `pickupConfirmedAdminAt`, and `pickupConfirmedAdminBy` already exist. |
| Pickup migration | `src/lib/db/migrations/0017_add_pickup_confirmation_fields.sql` | Adds pickup confirmation fields and indexes. |
| Auction statuses | `src/lib/db/schema/auctions.ts` | No `awaiting_pickup` or `picked_up`; statuses stop at `awaiting_payment`, `closed`, `cancelled`, `forfeited`. |
| Case statuses | `src/lib/db/schema/cases.ts` | No pickup-specific status; statuses are `draft`, `pending_approval`, `approved`, `active_auction`, `sold`, `cancelled`. |
| Pickup authorization document type | `src/lib/db/schema/release-forms.ts` | `pickup_authorization` exists and document data supports `pickupLocation`, `pickupDeadline`, and `pickupAuthCode`. |
| Pickup code generation | `src/features/auction-deposit/services/payment.service.ts`, `src/features/documents/services/document.service.ts` | Pickup codes are generated from the auction id prefix, for example `AUTH-${auctionId.substring(0, 8).toUpperCase()}`. That is deterministic and should be replaced before this becomes a release gate. |
| Vendor pickup confirmation API | `src/app/api/auctions/[id]/confirm-pickup/route.ts` | Vendor can submit code. It compares plaintext code from release-form data and sets vendor confirmation. It also logs the raw pickup code in audit data, which should be fixed. |
| Admin pickup confirmation API | `src/app/api/admin/auctions/[id]/confirm-pickup/route.ts` | `salvage_manager` and `system_admin` can confirm, but only after vendor confirmation. It updates the case to `sold`, not a pickup-completed state. |
| Pickup queue API | `src/app/api/admin/pickups/route.ts` | Supports pickup list for admin UI, centered on vendor-confirmed/admin-pending pickups. |
| Pickup page | `src/app/(dashboard)/admin/pickups/page.tsx` | Existing page is admin-focused. Salvage manager operational entry point is not yet first-class. |
| Staff confirmation component | `src/components/admin/admin-pickup-confirmation.tsx` | Confirms only after vendor confirmation. No global code lookup. |
| Vendor confirmation component | `src/components/vendor/pickup-confirmation.tsx` | Captures pickup code from vendor side. Useful, but should not be the only release path. |
| Admin dashboard KPI | `src/app/api/dashboard/admin/route.ts` | `pendingPickupConfirmations` counts vendor-confirmed but admin-unconfirmed pickups, not all paid items awaiting pickup. |
| Reminders | `src/lib/cron/pickup-reminders.ts`, `src/app/api/cron/pickup-reminders/route.ts` | Reminder infrastructure exists and can be reused after status model is corrected. |
| Tests | `tests/integration/auctions/*pickup*`, `tests/integration/admin/admin-pickups-page.test.ts`, `tests/e2e/escrow-wallet-payment-completion.spec.ts`, `tests/unit/components/pickup-confirmation.test.tsx` | Tests exist for the current vendor/admin pickup model, but new staff-code validation needs new tests. |

### Intelligence and Training Data Evidence

| Area | Evidence | Current state |
| --- | --- | --- |
| Intelligence schema | `src/lib/db/schema/intelligence.ts` | Predictions, recommendations, interactions, fraud alerts, algorithm config, and related analytics entities exist. |
| Interaction events | `src/lib/db/schema/intelligence.ts` | `interactionTypeEnum` only supports `view`, `bid`, `win`, `watch`, `unwatch`. This is too small for training-grade behavioral capture. |
| Interaction API | `src/app/api/intelligence/interactions/route.ts` | Records vendor interactions. It accepts `click_recommendation`, then stores it as `view` with original event in metadata because the enum does not support it. |
| Authorization gap | `src/app/api/intelligence/interactions/route.ts` | Code has a TODO to verify that `vendorId` belongs to the authenticated user. This must be fixed before using events as trusted training data. |
| Feature engineering | `src/features/intelligence/services/feature-engineering.service.ts` | Builds auction and vendor features, but several useful real-world features are placeholders or only partially populated. |
| Dataset export | `src/features/intelligence/services/ml-dataset.service.ts` | Supports ML dataset exports for price prediction, recommendations, and fraud detection. This is a useful starting point, not a complete training pipeline. |
| Existing docs | `docs/intelligence/ML_TRAINING_PIPELINE.md`, `docs/intelligence/PREDICTION_ALGORITHM.md`, `docs/intelligence/RECOMMENDATION_ALGORITHM.md`, `src/features/intelligence/README.md` | There is strong documentation scaffolding, but it should be updated once the event model and pickup lifecycle are upgraded. |

## Pickup Confirmation Target Design

### Business Rule

After winning bidder payment is verified and any required documents are signed, the auction should enter an operational pickup-ready state. The platform should issue a secure pickup authorization code. A salvage manager or authorized pickup officer verifies that code when the vendor arrives or when pickup is being released. Confirmation should update auction, case, dashboard, vendor performance, reports, and audit trail.

### Status Model

Add explicit lifecycle states.

Auction status additions:

- `awaiting_pickup`: payment is confirmed, pickup authorization has been issued, item is ready for release.
- `picked_up`: pickup/release has been confirmed by authorized staff.

Case status options:

- Conservative option: keep `sold` for paid auction, add pickup timestamps and report from auction pickup status.
- Better operational option: add `awaiting_pickup` and `completed` or `picked_up` to `case_status`.

Recommended approach:

- Add auction statuses first because pickup belongs to the auction sale lifecycle.
- Add case status only if dashboards and case queues need separate post-sale operational tracking.
- Keep backward-compatible mapping where existing `sold` cases with `pickupConfirmedAdmin = true` are interpreted as completed pickup.

### Ownership and Permissions

Primary:

- `salvage_manager` verifies and confirms pickup/release.

Secondary:

- `system_admin` can override, void, reissue, and audit pickup authorizations.

Read-only or exception:

- `finance` can see pickup status because pickup completes the value recovery lifecycle, but should not normally confirm release.
- `claims_adjuster` can see status for cases they created, but should not confirm release.
- `vendor` can view pickup authorization and status. Vendor-side confirmation can remain as "I am ready / I have arrived / I picked up," but final release must be staff-confirmed.

Future optional role:

- `pickup_officer` or `yard_officer` can be added later for clients with gate/yard staff. Do not add this role until the current roles are stable.

### Secure Pickup Authorization Model

Replace deterministic plaintext pickup codes with a dedicated authorization model.

Recommended table: `pickup_authorizations`

Fields:

- `id`
- `auction_id`
- `case_id`
- `vendor_id`
- `code_hash`
- `code_prefix` or `code_last4` for support display only
- `status`: `issued`, `verified`, `expired`, `voided`, `reissued`
- `issued_at`
- `expires_at`
- `verified_at`
- `verified_by`
- `voided_at`
- `voided_by`
- `attempt_count`
- `max_attempts`
- `last_attempt_at`
- `pickup_location_name`
- `pickup_latitude`
- `pickup_longitude`
- `metadata`
- `created_at`
- `updated_at`

Security rules:

- Generate a high-entropy random code, not one derived from the auction id.
- Store only a server-side hash. Use HMAC-SHA-256 with a server secret or a strong keyed hash strategy.
- Compare using constant-time comparison.
- Never store the raw code in audit logs.
- Never expose the raw code in admin lists.
- Allow reissue only to authorized staff and log it.
- Expire codes after a configurable policy window.
- Rate-limit global code verification attempts.
- Lock or step-up after repeated failed attempts.
- Audit each verification attempt with code prefix/last4 only, never the full code.

### User Experience

Build two staff workflows.

1. Global pickup code validator

- Route candidate: `/manager/pickups` with shared system-admin access.
- Primary input: "Enter pickup code".
- On valid code lookup, show:
  - asset name and claim/reference
  - auction id internally only
  - winning vendor
  - payment status
  - document status
  - pickup location
  - pickup deadline
  - warnings or holds
  - confirmation action
- Staff confirms pickup from this screen without manually finding the auction.

2. Auction-level pickup confirmation

- Add pickup confirmation card to salvage manager auction detail/payment detail page.
- Use this when staff already opened the auction.
- Staff can enter code, confirm release, reissue code, or mark exception.

Vendor-facing flow:

- After payment verification, vendor sees "Pickup ready" with pickup location, deadline, contact, and a note that the pickup code was sent through the configured notification channels.
- Vendor should not need to confirm before staff can release, but may have a "I am ready for pickup" signal if operations wants that queue.

Admin/system dashboard:

- Existing admin pickup page can become shared infrastructure, but salvage manager should have a first-class nav item because this is operational work.

### API Design

Recommended endpoints:

- `POST /api/pickups/verify-code`
  - Roles: `salvage_manager`, `system_admin`.
  - Body: `{ code }`.
  - Returns sanitized auction/case/vendor/payment/document summary.
  - Does not mark pickup complete.

- `POST /api/pickups/confirm`
  - Roles: `salvage_manager`, `system_admin`.
  - Body: `{ code, auctionId?, notes? }`.
  - Verifies code, payment, document state, role, expiry, attempts.
  - Marks pickup authorization verified.
  - Sets auction pickup completion fields and status.
  - Emits audit, notification, and training-data events.

- `POST /api/auctions/[id]/pickup/confirm`
  - Same confirmation, scoped to an auction.

- `POST /api/auctions/[id]/pickup/reissue`
  - Roles: `salvage_manager`, `system_admin`.
  - Voids old active code, issues new code, notifies vendor.

- `GET /api/pickups`
  - Query by status: `awaiting`, `vendor_ready`, `overdue`, `completed`, `exception`.

### Dashboard and Report Integration

Dashboard metrics:

- Pending pickups: paid/authorized but not staff-confirmed.
- Vendor-ready pickups: vendor signaled readiness, if that signal remains.
- Overdue pickups: pickup deadline exceeded.
- Completed pickups: confirmed staff release.
- Average payment-to-pickup time.
- Average win-to-pickup time.
- Pickup completion rate.
- Pickup exceptions by reason.

Reports:

- Master report should include pickup status, pickup confirmed at, pickup confirmed by, payment-to-pickup duration, win-to-pickup duration.
- Revenue/profitability reports should show completed pickup as a separate lifecycle milestone from payment.
- Vendor performance should include pickup punctuality and exception history.
- Operational reports should expose bottlenecks:
  - won to payment
  - payment to document completion
  - payment to pickup authorization issued
  - pickup authorization issued to pickup confirmed

### Migration and Backfill Plan

1. Add pickup statuses and pickup authorization table.
2. Backfill existing pickup authorization docs:
   - If a pickup authorization document exists and payment is complete, create `pickup_authorizations` row.
   - If `pickupConfirmedAdmin = true`, mark as verified/completed.
   - If payment is complete but no pickup doc exists, issue a new code.
3. Keep old confirmation fields temporarily for compatibility.
4. Once new flow is stable, either remove old vendor-first assumptions or preserve them as optional vendor-ready signals.

### Pickup Acceptance Criteria

- Paid auctions enter `awaiting_pickup`.
- A secure pickup code is generated and sent after payment, not before.
- Staff can verify a code globally without finding the auction first.
- Staff can confirm pickup from an auction detail page.
- Raw pickup code is not stored in audit logs.
- Failed verification attempts are rate-limited and audited safely.
- Dashboards show pending, overdue, and completed pickups.
- Reports show payment-to-pickup and win-to-pickup timing.
- Vendor performance can use pickup punctuality.
- Existing vendor/admin pickup tests are updated instead of deleted.

## Training Data and ML Event Pipeline Target Design

### Core Principle

Audit logs and ML/product events must not be the same system.

Audit logs should remain compliance/legal/security records. They should be low-volume, immutable, access-controlled, and intentionally conservative.

Training/product events should capture high-volume behavior and operational facts. They should be schema-versioned, privacy-controlled, deduplicated, and exportable into curated datasets.

### Current Gap

The existing `interactions` table is useful but too narrow. It captures basic vendor/auction interaction types and some metadata. It does not cover enough of the actual salvage lifecycle or enough user behavior to train serious models.

Known issue:

- `src/app/api/intelligence/interactions/route.ts` has a TODO to verify that a `vendorId` belongs to the current user. That must be fixed before events are treated as trustworthy.
- The API accepts `click_recommendation`, but the database enum cannot store it directly. This is a signal that the event taxonomy has outgrown the current enum.

### Event Model

Add a dedicated product/domain event table, or replace/extend `interactions` with a more general event system.

Recommended table: `product_events`

Fields:

- `id`
- `event_name`
- `event_version`
- `occurred_at`
- `received_at`
- `actor_user_id`
- `actor_role`
- `vendor_id`
- `case_id`
- `auction_id`
- `payment_id`
- `document_id`
- `session_id`
- `request_id`
- `source`: `client`, `server`, `cron`, `webhook`, `admin_action`
- `idempotency_key`
- `client_context`
- `event_context`
- `metadata`
- `privacy_classification`: `public`, `internal`, `personal`, `sensitive`
- `training_allowed`
- `retention_class`
- `created_at`

Keep `interactions` as a compatibility view or legacy table while migrating.

### Event Taxonomy

Capture these groups.

Auction and marketplace:

- `auction_viewed`
- `auction_card_seen`
- `auction_image_viewed`
- `auction_filter_applied`
- `auction_sort_changed`
- `auction_search_performed`
- `auction_watch_added`
- `auction_watch_removed`
- `bid_attempted`
- `bid_rejected`
- `bid_placed`
- `bid_outbid`
- `auction_won`
- `auction_lost`
- `auction_extended`
- `auction_closed`

Case and valuation:

- `case_created`
- `case_photo_uploaded`
- `case_voice_note_added`
- `ai_assessment_requested`
- `ai_assessment_completed`
- `valuation_market_search_performed`
- `valuation_manual_value_used`
- `valuation_reviewed`
- `case_approved`
- `case_rejected`

Vendor/KYC:

- `vendor_registered`
- `kyc_started`
- `kyc_cancelled`
- `kyc_failed`
- `kyc_completed`
- `vendor_approved`
- `vendor_rejected`
- `tier_changed`

Wallet/payment:

- `wallet_funding_started`
- `wallet_funding_completed`
- `deposit_frozen`
- `deposit_released`
- `payment_started`
- `payment_webhook_received`
- `payment_verified`
- `payment_retry_requested`
- `payment_failed`

Documents:

- `document_generated`
- `document_viewed`
- `document_signed`
- `document_rejected`
- `document_downloaded`

Pickup:

- `pickup_authorization_issued`
- `pickup_code_lookup_attempted`
- `pickup_code_verified`
- `pickup_code_failed`
- `pickup_confirmed`
- `pickup_overdue`
- `pickup_code_reissued`

Fraud/risk:

- `fraud_signal_created`
- `fraud_alert_opened`
- `fraud_alert_resolved`
- `duplicate_case_detected`
- `suspicious_bid_pattern_detected`

### Capture Strategy

Client-side:

- Add a small `trackEvent` utility for low-risk UI events.
- Queue events and send in batches.
- Respect privacy preferences where required.
- Do not capture raw form content unless explicitly needed and classified.

Server-side:

- Emit domain events from the service layer for authoritative actions:
  - bids
  - payments
  - KYC decisions
  - document generation/signing
  - pickup code issuance/verification
  - case approval/rejection
  - auction closure

Reliability:

- Use a lightweight outbox table for server domain events so critical events are not lost when a request completes but analytics write fails.
- Add idempotency keys for webhook and retry events.

### Privacy and Data Protection Rules

Do not export these to model training datasets by default:

- BVN/NIN
- raw ID images
- raw Dojah payloads
- raw payment provider payloads
- full addresses unless location granularity is intentionally needed
- document file URLs
- pickup authorization codes
- raw phone/email unless a specific approved use case requires it

Use these instead:

- pseudonymous user/vendor ids
- age bands instead of dates of birth
- region/locality buckets instead of exact address where possible
- normalized KYC result flags, not raw KYC payloads
- normalized payment status, amount, timing, and provider result
- normalized pickup timing and exception flags

### Curated Dataset Pipeline

Build datasets from operational tables plus product events, not from product events alone.

Datasets:

- Price prediction dataset:
  - asset type, make/model/year where available, condition, mileage, damage severity, damaged parts, photos quality summary, claims paid/market value, reserve, auction duration, final bid, bid count, unique bidders, location bucket, seasonality.

- Recovery performance dataset:
  - claim paid, reserve, final sale, recovery ratio, cycle times, payment timing, pickup timing, vendor count, auction extensions.

- Vendor reliability dataset:
  - bid history, win rate, payment speed, pickup speed, deposit failures, document delays, disputes, KYC tier, account age.

- Fraud/collusion dataset:
  - repeated bidder clusters, bid timing, outbid patterns, shared devices/IP where legally usable, duplicate assets, unusual payment behavior, suspicious location/device changes.

- Recommendation dataset:
  - vendor preferences, watched auctions, views, filters, bids, categories, price bands, locations, won/lost outcomes.

### Data Quality Controls

- Validate every event with a schema.
- Version event schemas.
- Server-stamp `received_at`.
- Deduplicate by idempotency key.
- Separate internal/test users from production learning data.
- Mark synthetic/test data.
- Track missingness and data drift.
- Keep dataset lineage: source query, date range, row count, schema version, anonymization status.

### Training Data Acceptance Criteria

- Interaction endpoint verifies vendor ownership.
- Event taxonomy is not constrained by the old five-value enum.
- Product events are separate from audit logs.
- Product event collection does not store unnecessary sensitive data.
- Domain events are emitted for bids, payments, documents, pickup, KYC, case approval, and auction closure.
- Dataset exports include lineage and anonymization metadata.
- Admin can export curated datasets without raw sensitive provider payloads.
- The platform can explain which data is used for model training and which is excluded.

## Implementation Roadmap

### Phase 1: Pickup Foundation

1. Add `awaiting_pickup` and `picked_up` auction statuses.
2. Add `pickup_authorizations` table.
3. Replace deterministic pickup codes with random hash-stored codes.
4. Remove raw pickup code from audit logs.
5. Move payment-complete flow to issue pickup authorization and set `awaiting_pickup`.
6. Add backfill migration for existing pickup authorization docs.

### Phase 2: Pickup UX

1. Build shared pickup operations page for `salvage_manager` and `system_admin`.
2. Add global code lookup and confirmation.
3. Add auction-level pickup confirmation card.
4. Keep vendor pickup card as status/readiness, not final release authority.
5. Add reissue and exception actions.

### Phase 3: Pickup Reporting

1. Add pickup KPIs to admin and salvage manager dashboards.
2. Add pickup fields to master and operational reports.
3. Add vendor pickup punctuality to vendor performance.
4. Add pickup SLA clocks.

### Phase 4: Training Event Foundation

1. Fix ownership authorization in `POST /api/intelligence/interactions`.
2. Add general product/domain event schema.
3. Add server domain-event emitter.
4. Add client event utility for safe UI events.
5. Add event schema validation and idempotency.

### Phase 5: Curated ML Datasets

1. Build curated dataset definitions for price prediction, recovery performance, vendor reliability, fraud, and recommendations.
2. Add anonymization/pseudonymization guardrails.
3. Add dataset lineage records.
4. Add admin export and scheduled dataset generation.
5. Update `docs/intelligence/ML_TRAINING_PIPELINE.md` after implementation.

## Direct Answer to the Product Question

Yes, this is possible.

The pickup workflow is not a huge invention from scratch because the repository already has pickup documents, confirmation fields, APIs, pages, reminders, and tests. But it does require a real status model, secure authorization-code handling, manager-facing code lookup, and reporting integration before it behaves the way the business needs.

The data-gathering plan is also possible because the intelligence subsystem already has predictions, interactions, feature engineering, ML exports, fraud alerts, and admin analytics. But it is not comprehensive enough yet for serious model training. The next level is a dedicated product/domain event pipeline with privacy controls and curated datasets.

The highest-risk item to fix first is pickup-code security: deterministic plaintext codes and raw code audit logging should not be used as the long-term release control for physical asset pickup.
